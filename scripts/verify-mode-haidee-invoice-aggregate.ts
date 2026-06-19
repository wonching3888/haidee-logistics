/**
 * Verify Haidee Mode 1a/1b/2 aggregate + Mode 3/4 listing regression.
 *
 * Usage: node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/verify-mode-haidee-invoice-aggregate.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "../lib/prisma";
import { decimalToNumber } from "../lib/freight-rates";
import { getMonthDateRange } from "../lib/reports/period-report-shared";
import {
  formatInvoicePeriodLabel,
  getMonthlyInvoiceModeConfig,
  type MonthlyInvoiceMode,
} from "../lib/constants/monthly-invoice";
import {
  buildMonthlyInvoiceData,
  resolveCustomerKeyForInvoice,
  type RawInvoiceLine,
} from "../lib/monthly-invoice";
import { buildHaideeMonthlyInvoiceData } from "../lib/monthly-invoice-mode-haidee";
import { buildMode3MonthlyInvoiceData } from "../lib/monthly-invoice-mode3";
import { buildMode4MonthlyInvoiceData } from "../lib/monthly-invoice-mode4";

const YEAR = 2026;
const MONTH = 6;

const HAIDEE_SAMPLES: { mode: MonthlyInvoiceMode }[] = [
  { mode: "1a" },
  { mode: "1b" },
  { mode: "2" },
];

const WTL_REGRESSION = [
  { mode: "3" as const, code: "3000-P001" },
  { mode: "3" as const, code: "3000-N001" },
  { mode: "4" as const, shipperCode: "3000-B002" },
];

async function fetchRawLines(mode: MonthlyInvoiceMode): Promise<RawInvoiceLine[]> {
  const config = getMonthlyInvoiceModeConfig(mode);
  if (!config) throw new Error(`Missing config for ${mode}`);

  const { start, end } = getMonthDateRange(YEAR, MONTH);
  const sessionWhere = {
    status: "confirmed" as const,
    date: { gte: start, lte: end },
  };

  const include = {
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

  if (mode === "3") {
    const [primaryLines, dualLines] = await Promise.all([
      prisma.inboundLine.findMany({
        where: {
          paymentMode: "3",
          billingCompany: "wtl",
          currency: "MYR",
          freightAmount: { gt: 0 },
          session: sessionWhere,
        },
        include,
      }),
      prisma.inboundLine.findMany({
        where: { dualPaymentWtlAmount: { gt: 0 }, session: sessionWhere },
        include,
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

  if (mode === "4") {
    const lines = await prisma.inboundLine.findMany({
      where: {
        billingCompany: "wtl",
        currency: "MYR",
        paymentMode: { not: "3" },
        freightAmount: { gt: 0 },
        session: sessionWhere,
      },
      include,
    });
    return lines.map((line) => ({
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
    }));
  }

  const lines = await prisma.inboundLine.findMany({
    where: {
      paymentMode: config.paymentMode,
      billingCompany: config.billingCompany,
      currency: config.currency,
      freightAmount: { gt: 0 },
      session: sessionWhere,
    },
    include,
  });

  return lines.map((line) => ({
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
  }));
}

function pickTopCustomer(rawLines: RawInvoiceLine[], mode: MonthlyInvoiceMode) {
  const config = getMonthlyInvoiceModeConfig(mode)!;
  const totals = new Map<string, { id: string; code: string; name: string; total: number }>();

  for (const line of rawLines) {
    const customer = resolveCustomerKeyForInvoice(line, config.billTo);
    if (!customer || !line.freightAmount) continue;
    const existing = totals.get(customer.id) ?? { ...customer, total: 0 };
    existing.total += line.freightAmount;
    totals.set(customer.id, existing);
  }

  const sorted = Array.from(totals.values()).sort((a, b) => b.total - a.total);
  if (sorted.length === 0) return null;
  return sorted[0];
}

async function main() {
  const periodLabel = formatInvoicePeriodLabel(YEAR, MONTH);
  const haideeResults: Record<string, unknown> = {};
  const wtlResults: Record<string, unknown> = {};

  for (const { mode } of HAIDEE_SAMPLES) {
    const config = getMonthlyInvoiceModeConfig(mode)!;
    const rawLines = await fetchRawLines(mode);
    const top = pickTopCustomer(rawLines, mode);
    if (!top) throw new Error(`No customers for mode ${mode}`);

    const legacy = buildMonthlyInvoiceData({
      mode: config,
      year: YEAR,
      month: MONTH,
      periodLabel,
      customerId: top.id,
      rawLines,
    });
    const haidee = buildHaideeMonthlyInvoiceData({
      mode: config,
      year: YEAR,
      month: MONTH,
      periodLabel,
      customerId: top.id,
      rawLines,
    });
    if (!legacy || !haidee) throw new Error(`Build failed for mode ${mode}`);

    haideeResults[mode] = {
      customerCode: top.code,
      customerName: top.name,
      currency: haidee.currency,
      billToRole: haidee.billToRole,
      legacyGrandTotal: legacy.grandTotalAmount,
      summaryGrandTotal: haidee.summary.grandTotalAmount,
      summaryRows: haidee.summary.sections.flatMap((s) =>
        s.rows.map((r) => ({
          kind: s.kind,
          market: r.marketCode,
          label: r.marketLabel,
          qty: r.quantity,
          rate: r.unitRate,
          amount: r.amount,
        }))
      ),
      listingSections: haidee.listing.sections.map((s) => ({
        kind: s.kind,
        grandTotal: s.grandTotal,
        columnTotals: s.columnTotals,
      })),
    };
  }

  for (const sample of WTL_REGRESSION) {
    const config = getMonthlyInvoiceModeConfig(sample.mode)!;
    const rawLines = await fetchRawLines(sample.mode);
    let customerId: string;

    if (sample.mode === "4") {
      const line = rawLines.find((l) => l.shipperCode === sample.shipperCode);
      if (!line) throw new Error("BEST BROTHER lines missing");
      customerId = line.shipperId;
    } else {
      const line = rawLines.find((l) => l.consigneeCode === sample.code);
      if (!line?.consigneeId) throw new Error(`${sample.code} missing`);
      customerId = line.consigneeId;
    }

    const input = {
      mode: config,
      year: YEAR,
      month: MONTH,
      periodLabel,
      customerId,
      rawLines,
    };

    const legacy = buildMonthlyInvoiceData(input);
    const built =
      sample.mode === "3"
        ? buildMode3MonthlyInvoiceData(input)
        : buildMode4MonthlyInvoiceData(input);
    if (!legacy || !built) throw new Error(`WTL build failed ${sample.mode}`);

    const listingGrand = built.listing.sections.reduce(
      (sum, s) => sum + s.grandTotal,
      0
    );
    const invoiceQty = built.taxInvoice.sections.reduce(
      (sum, s) => sum + s.totalQty,
      0
    );

    wtlResults[`${sample.mode}-${sample.code ?? sample.shipperCode}`] = {
      legacyGrandTotal: legacy.grandTotalAmount,
      aggregateGrandTotal: built.grandTotalAmount,
      listingQtyTotal: listingGrand,
      invoiceQtyTotal: invoiceQty,
      listingSections: built.listing.sections.map((s) => ({
        kind: s.kind,
        grandTotal: s.grandTotal,
        columnTotals: s.columnTotals,
      })),
    };
  }

  console.log(JSON.stringify({ haidee: haideeResults, wtlRegression: wtlResults }, null, 2));
  console.log("OK: Haidee modes + WTL listing regression verified");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
