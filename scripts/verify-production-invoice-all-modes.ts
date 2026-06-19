/**
 * Production post-deploy invoice verification for all modes (read-only).
 * Usage: node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/verify-production-invoice-all-modes.ts
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

const SAMPLES: {
  mode: MonthlyInvoiceMode;
  code: string;
  kind: "shipper" | "consignee";
}[] = [
  { mode: "1a", code: "3001-A004", kind: "shipper" },
  { mode: "1b", code: "3002-S006", kind: "shipper" },
  { mode: "2", code: "3002-N002", kind: "consignee" },
  { mode: "3", code: "3000-P001", kind: "consignee" },
  { mode: "3", code: "3000-N001", kind: "consignee" },
  { mode: "4", code: "3000-B002", kind: "shipper" },
];

function dbHostLabel(url: string | undefined) {
  if (!url) return "(missing)";
  try {
    return new URL(url).host;
  } catch {
    return "(invalid)";
  }
}

async function fetchRawLines(mode: MonthlyInvoiceMode): Promise<RawInvoiceLine[]> {
  const config = getMonthlyInvoiceModeConfig(mode)!;
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
      const c = line.dualPaymentWtlConsignee;
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
        consigneeId: line.dualPaymentWtlConsigneeId ?? c?.id ?? null,
        consigneeCode: c?.code ?? null,
        consigneeName: c?.name ?? null,
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

async function resolveCustomerId(
  rawLines: RawInvoiceLine[],
  mode: MonthlyInvoiceMode,
  code: string,
  kind: "shipper" | "consignee"
) {
  const config = getMonthlyInvoiceModeConfig(mode)!;
  if (kind === "shipper") {
    const shipper = await prisma.shipper.findUnique({ where: { code } });
    if (!shipper) throw new Error(`Shipper not found: ${code}`);
    return shipper.id;
  }
  const consignee = await prisma.consignee.findUnique({ where: { code } });
  if (!consignee) throw new Error(`Consignee not found: ${code}`);
  const hasLines = rawLines.some((line) => {
    const customer = resolveCustomerKeyForInvoice(line, config.billTo);
    return customer?.id === consignee.id;
  });
  if (!hasLines) throw new Error(`No invoice lines for ${code} in mode ${mode}`);
  return consignee.id;
}

async function main() {
  console.log("DATABASE host:", dbHostLabel(process.env.DATABASE_URL));
  const periodLabel = formatInvoicePeriodLabel(YEAR, MONTH);
  const results: Record<string, unknown> = {};

  const rawByMode = new Map<MonthlyInvoiceMode, RawInvoiceLine[]>();
  for (const mode of ["1a", "1b", "2", "3", "4"] as MonthlyInvoiceMode[]) {
    rawByMode.set(mode, await fetchRawLines(mode));
  }

  for (const sample of SAMPLES) {
    const key = `${sample.mode}-${sample.code}`;
    const config = getMonthlyInvoiceModeConfig(sample.mode)!;
    const rawLines = rawByMode.get(sample.mode)!;
    const customerId = await resolveCustomerId(
      rawLines,
      sample.mode,
      sample.code,
      sample.kind
    );

    const input = {
      mode: config,
      year: YEAR,
      month: MONTH,
      periodLabel,
      customerId,
      rawLines,
    };

    const legacy = buildMonthlyInvoiceData(input);
    if (!legacy) throw new Error(`Legacy null: ${key}`);

    if (sample.mode === "1a" || sample.mode === "1b" || sample.mode === "2") {
      const haidee = buildHaideeMonthlyInvoiceData(input);
      if (!haidee) throw new Error(`Haidee null: ${key}`);
      if (haidee.summary.grandTotalAmount !== legacy.grandTotalAmount) {
        throw new Error(
          `${key}: summary ${haidee.summary.grandTotalAmount} != legacy ${legacy.grandTotalAmount}`
        );
      }
      results[key] = {
        currency: haidee.currency,
        legacyGrandTotal: legacy.grandTotalAmount,
        aggregateGrandTotal: haidee.summary.grandTotalAmount,
        listingQty: haidee.listing.sections.reduce((s, x) => s + x.grandTotal, 0),
        invoiceQty: haidee.summary.grandTotalQty,
        match: true,
      };
    } else if (sample.mode === "3") {
      const mode3 = buildMode3MonthlyInvoiceData(input);
      if (!mode3) throw new Error(`Mode3 null: ${key}`);
      if (mode3.grandTotalAmount !== legacy.grandTotalAmount) {
        throw new Error(`${key}: aggregate != legacy`);
      }
      results[key] = {
        currency: mode3.currency,
        legacyGrandTotal: legacy.grandTotalAmount,
        aggregateGrandTotal: mode3.grandTotalAmount,
        listingQty: mode3.listing.sections.reduce((s, x) => s + x.grandTotal, 0),
        invoiceQty: mode3.taxInvoice.grandTotalQty,
        grandTh: mode3.taxInvoice.grandThTotalAmount,
        match: true,
      };
    } else {
      const mode4 = buildMode4MonthlyInvoiceData(input);
      if (!mode4) throw new Error(`Mode4 null: ${key}`);
      if (mode4.grandTotalAmount !== legacy.grandTotalAmount) {
        throw new Error(`${key}: aggregate != legacy`);
      }
      results[key] = {
        currency: mode4.currency,
        legacyGrandTotal: legacy.grandTotalAmount,
        aggregateGrandTotal: mode4.grandTotalAmount,
        listingQty: mode4.listing.sections.reduce((s, x) => s + x.grandTotal, 0),
        invoiceQty: mode4.taxInvoice.grandTotalQty,
        match: true,
      };
    }
  }

  console.log(JSON.stringify({ verifiedAt: new Date().toISOString(), results }, null, 2));
  console.log("OK: all production invoice samples match legacy totals");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
