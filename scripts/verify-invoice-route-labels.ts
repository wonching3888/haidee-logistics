/**
 * Verify invoice route labels use INVOICE_MARKET_SHORT_NAMES + BEST BROTHER June data.
 *
 * Usage: node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/verify-invoice-route-labels.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "../lib/prisma";
import { decimalToNumber } from "../lib/freight-rates";
import { getMonthDateRange } from "../lib/reports/period-report-shared";
import { getMonthlyInvoiceModeConfig } from "../lib/constants/monthly-invoice";
import {
  buildAllInvoiceRouteLabels,
  getInvoiceRouteLabel,
  INVOICE_MARKET_SHORT_NAMES,
  INVOICE_ROUTE_MARKET_CODES,
} from "../lib/constants/invoice-route-labels";
import { buildMode4MonthlyInvoiceData } from "../lib/monthly-invoice-mode4";
import type { RawInvoiceLine } from "../lib/monthly-invoice";

const SHIPPER_CODE = "3000-B002";

async function fetchBbRawLines(): Promise<RawInvoiceLine[]> {
  const { start, end } = getMonthDateRange(2026, 6);
  const lines = await prisma.inboundLine.findMany({
    where: {
      billingCompany: "wtl",
      currency: "MYR",
      paymentMode: { not: "3" },
      freightAmount: { gt: 0 },
      session: {
        status: "confirmed",
        date: { gte: start, lte: end },
        shipper: { code: SHIPPER_CODE },
      },
    },
    include: {
      session: {
        select: {
          date: true,
          shipper: { select: { id: true, code: true, name: true } },
        },
      },
      stall: { include: { market: { select: { code: true, name: true } } } },
      tongType: { select: { code: true, isBox: true } },
      consignee: { select: { id: true, code: true, name: true } },
    },
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

async function main() {
  console.log("=== 1. All 14 invoice route labels ===");
  const allLabels = buildAllInvoiceRouteLabels();
  for (const code of INVOICE_ROUTE_MARKET_CODES) {
    const shortName = INVOICE_MARKET_SHORT_NAMES[code];
    const label = allLabels[code];
    const ok = label === `BKT KAYU HITAM TO ${shortName}`;
    console.log(`${code}: "${label}" ${ok ? "OK" : "FAIL"}`);
    if (!ok) process.exitCode = 1;
  }

  const rawLines = await fetchBbRawLines();
  const shipperId = rawLines[0]?.shipperId;
  const mode = getMonthlyInvoiceModeConfig("4")!;
  const data = buildMode4MonthlyInvoiceData({
    mode,
    year: 2026,
    month: 6,
    periodLabel: "2026年6月",
    customerId: shipperId!,
    rawLines,
  });
  if (!data) throw new Error("no invoice data");

  console.log("\n=== 2. BEST BROTHER June MY rows ===");
  const checks = {
    KL: "BKT KAYU HITAM TO SELAYANG",
    A: "BKT KAYU HITAM TO IPOH",
    KD: "BKT KAYU HITAM TO KEDAH",
  };
  const myRows = data.taxInvoice.sections.flatMap((s) => s.myRows);
  for (const [code, expected] of Object.entries(checks)) {
    const row = myRows.find((r) => r.marketCode === code);
    const ok = row?.routeLabel === expected;
    console.log(`${code}: "${row?.routeLabel}" expected "${expected}" ${ok ? "OK" : "FAIL"}`);
    if (!ok) process.exitCode = 1;
  }

  console.log("\n=== Summary ===");
  console.log({
    grandTotal: data.grandTotalAmount,
    bpLabel: getInvoiceRouteLabel("BP"),
    mpLabel: getInvoiceRouteLabel("MP"),
    jbLabel: getInvoiceRouteLabel("JB"),
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
