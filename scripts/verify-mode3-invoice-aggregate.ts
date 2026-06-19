/**
 * Verify Mode 3 aggregate + listing for P001 and NKL June 2026.
 *
 * Usage: node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/verify-mode3-invoice-aggregate.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "../lib/prisma";
import { decimalToNumber } from "../lib/freight-rates";
import { getMonthDateRange } from "../lib/reports/period-report-shared";
import {
  formatInvoicePeriodLabel,
  getMonthlyInvoiceModeConfig,
} from "../lib/constants/monthly-invoice";
import {
  buildMonthlyInvoiceData,
  resolveCustomerKeyForInvoice,
  type RawInvoiceLine,
} from "../lib/monthly-invoice";
import { buildMode3MonthlyInvoiceData } from "../lib/monthly-invoice-mode3";

const YEAR = 2026;
const MONTH = 6;

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

async function fetchMode3RawLines(): Promise<RawInvoiceLine[]> {
  const { start, end } = getMonthDateRange(YEAR, MONTH);
  const sessionWhere = {
    status: "confirmed" as const,
    date: { gte: start, lte: end },
  };

  const invoiceLineInclude = {
    session: {
      select: {
        date: true,
        shipper: { select: { id: true, code: true, name: true } },
      },
    },
    stall: { include: { market: { select: { code: true } } } },
    tongType: { select: { code: true, isBox: true } },
    consignee: { select: { id: true, code: true, name: true } },
    dualPaymentWtlConsignee: { select: { id: true, code: true, name: true } },
  };

  const [primaryLines, dualLines] = await Promise.all([
    prisma.inboundLine.findMany({
      where: {
        paymentMode: "3",
        billingCompany: "wtl",
        currency: "MYR",
        freightAmount: { gt: 0 },
        session: sessionWhere,
      },
      include: invoiceLineInclude,
    }),
    prisma.inboundLine.findMany({
      where: {
        dualPaymentWtlAmount: { gt: 0 },
        session: sessionWhere,
      },
      include: invoiceLineInclude,
    }),
  ]);

  const mapPrimary = (line: (typeof primaryLines)[number]): RawInvoiceLine => ({
    sessionDate: line.session.date,
    stallMarketCode: line.stall.market?.code ?? "",
    stallCode: line.stall.code,
    stallName: line.stall.name,
    tongTypeCode: line.tongType.code,
    quantity: line.quantity,
    freightRate: decimalToNumber(line.freightRate),
    freightAmount: decimalToNumber(line.freightAmount),
    thFreightRate: decimalToNumber(line.thFreightRate),
    thFreightAmount: decimalToNumber(line.thFreightAmount),
    mySegmentFreightRate: decimalToNumber(line.mySegmentFreightRate),
    mySegmentFreightAmount: decimalToNumber(line.mySegmentFreightAmount),
    isBox: line.isBox,
    shipperId: line.session.shipper.id,
    shipperCode: line.session.shipper.code,
    shipperName: line.session.shipper.name,
    consigneeId: line.consigneeId ?? line.consignee?.id ?? null,
    consigneeCode: line.consignee?.code ?? null,
    consigneeName: line.consignee?.name ?? null,
  });

  const mapDual = (line: (typeof dualLines)[number]): RawInvoiceLine => {
    const consignee = line.dualPaymentWtlConsignee;
    return {
      sessionDate: line.session.date,
      stallMarketCode: line.stall.market?.code ?? "",
      stallCode: line.stall.code,
      stallName: line.stall.name,
      tongTypeCode: line.tongType.code,
      quantity: line.quantity,
      freightRate: decimalToNumber(line.dualPaymentWtlRate),
      freightAmount: decimalToNumber(line.dualPaymentWtlAmount),
      thFreightRate: null,
      thFreightAmount: null,
      mySegmentFreightRate: null,
      mySegmentFreightAmount: null,
      isBox: line.isBox,
      shipperId: line.session.shipper.id,
      shipperCode: line.session.shipper.code,
      shipperName: line.session.shipper.name,
      consigneeId: line.dualPaymentWtlConsigneeId ?? consignee?.id ?? null,
      consigneeCode: consignee?.code ?? null,
      consigneeName: consignee?.name ?? null,
    };
  };

  return [...primaryLines.map(mapPrimary), ...dualLines.map(mapDual)];
}

async function verifyConsignee(
  rawLines: RawInvoiceLine[],
  consigneeCode: string,
  expectedGrandTotal: number
) {
  const mode = getMonthlyInvoiceModeConfig("3");
  if (!mode) throw new Error("Mode 3 config missing");

  const sample = rawLines.find((l) => l.consigneeCode === consigneeCode);
  if (!sample?.consigneeId) {
    throw new Error(`No lines for consignee ${consigneeCode}`);
  }

  const customer = resolveCustomerKeyForInvoice(sample, mode.billTo);
  if (!customer) throw new Error(`Could not resolve ${consigneeCode}`);

  const periodLabel = formatInvoicePeriodLabel(YEAR, MONTH);
  const legacy = buildMonthlyInvoiceData({
    mode,
    year: YEAR,
    month: MONTH,
    periodLabel,
    customerId: customer.id,
    rawLines,
  });
  if (!legacy) throw new Error(`Legacy null for ${consigneeCode}`);

  const mode3 = buildMode3MonthlyInvoiceData({
    mode,
    year: YEAR,
    month: MONTH,
    periodLabel,
    customerId: customer.id,
    rawLines,
  });
  if (!mode3) throw new Error(`Mode3 null for ${consigneeCode}`);

  assertEqual(legacy.grandTotalAmount, expectedGrandTotal, `${consigneeCode} legacy`);
  assertEqual(mode3.grandTotalAmount, expectedGrandTotal, `${consigneeCode} mode3`);
  assertEqual(
    mode3.taxInvoice.totals.totalInclusive,
    expectedGrandTotal,
    `${consigneeCode} totalInclusive`
  );
  assertEqual(
    mode3.taxInvoice.totals.subTotalExcludingTax + mode3.taxInvoice.totals.sstAmount,
    expectedGrandTotal,
    `${consigneeCode} subTotal+sst`
  );

  const tongSection = mode3.taxInvoice.sections.find((s) => s.kind === "tong");
  const boxSection = mode3.taxInvoice.sections.find((s) => s.kind === "box");

  return {
    consigneeCode,
    customerName: customer.name,
    legacyGrandTotal: legacy.grandTotalAmount,
    mode3GrandTotal: mode3.grandTotalAmount,
    billToRole: mode3.billToRole,
    tongThRow: tongSection?.thRow ?? null,
    boxThRow: boxSection?.thRow ?? null,
    tongMyRows: tongSection?.myRows ?? [],
    boxMyRows: boxSection?.myRows ?? [],
    grandThTotal: mode3.taxInvoice.grandThTotalAmount,
    grandMyInclusive: mode3.taxInvoice.grandMyInclusiveTotal,
    subTotalExcludingTax: mode3.taxInvoice.totals.subTotalExcludingTax,
    sstBase: mode3.taxInvoice.totals.sstBase,
    sstAmount: mode3.taxInvoice.totals.sstAmount,
    listingSections: mode3.listing.sections.map((s) => ({
      kind: s.kind,
      grandTotal: s.grandTotal,
      columnTotals: s.columnTotals,
    })),
  };
}

async function main() {
  const rawLines = await fetchMode3RawLines();

  const p001 = await verifyConsignee(rawLines, "3000-P001", 2655);
  const nkl = await verifyConsignee(rawLines, "3000-N001", 497.28);

  if (p001.tongThRow != null || p001.boxThRow != null) {
    throw new Error("P001 should not have TH summary row");
  }
  const p001Mc = p001.tongMyRows.find((r) => r.marketCode === "MC");
  if (!p001Mc || p001Mc.amount !== 2655) {
    throw new Error(`P001 MC MY row expected 2655, got ${p001Mc?.amount}`);
  }

  if (nkl.boxThRow == null || nkl.boxThRow.amount !== 192) {
    throw new Error(`NKL box TH row expected 192, got ${nkl.boxThRow?.amount}`);
  }
  const nklKt = nkl.boxMyRows.find((r) => r.marketCode === "KT");
  if (!nklKt || nklKt.amount !== 305.28) {
    throw new Error(`NKL KT MY row expected 305.28, got ${nklKt?.amount}`);
  }

  console.log(JSON.stringify({ p001, nkl }, null, 2));
  console.log("OK: Mode 3 aggregate matches legacy for P001 and NKL");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
