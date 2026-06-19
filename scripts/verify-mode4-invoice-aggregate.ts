/**
 * Verify Mode 4 aggregate + listing totals against legacy invoice for BEST BROTHER June 2026.
 *
 * Usage: node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/verify-mode4-invoice-aggregate.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "../lib/prisma";
import { decimalToNumber } from "../lib/freight-rates";
import { getMonthDateRange } from "../lib/reports/period-report-shared";
import { getMonthlyInvoiceModeConfig } from "../lib/constants/monthly-invoice";
import {
  buildMonthlyInvoiceData,
  resolveCustomerKeyForInvoice,
  type RawInvoiceLine,
} from "../lib/monthly-invoice";
import { buildMode4MonthlyInvoiceData } from "../lib/monthly-invoice-mode4";

const SHIPPER_CODE = "3000-B002";
const YEAR = 2026;
const MONTH = 6;

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

async function fetchMode4RawLines(): Promise<RawInvoiceLine[]> {
  const { start, end } = getMonthDateRange(YEAR, MONTH);
  const lines = await prisma.inboundLine.findMany({
    where: {
      billingCompany: "wtl",
      currency: "MYR",
      paymentMode: { not: "3" },
      freightAmount: { gt: 0 },
      session: {
        status: "confirmed",
        date: { gte: start, lte: end },
      },
    },
    include: {
      session: {
        select: {
          date: true,
          shipper: { select: { id: true, code: true, name: true } },
        },
      },
      stall: {
        include: { market: { select: { code: true } } },
      },
      tongType: { select: { code: true, isBox: true } },
      consignee: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ session: { date: "asc" } }, { createdAt: "asc" }],
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
  const mode = getMonthlyInvoiceModeConfig("4");
  if (!mode) throw new Error("Mode 4 config missing");

  const rawLines = await fetchMode4RawLines();
  const shipperLines = rawLines.filter(
    (line) => line.shipperCode === SHIPPER_CODE
  );
  if (shipperLines.length === 0) {
    throw new Error(`No Mode 4 lines for shipper ${SHIPPER_CODE}`);
  }

  const customer = resolveCustomerKeyForInvoice(shipperLines[0], mode.billTo);
  if (!customer) throw new Error("Could not resolve shipper customer");

  const legacy = buildMonthlyInvoiceData({
    mode,
    year: YEAR,
    month: MONTH,
    periodLabel: `${YEAR}年${MONTH}月`,
    customerId: customer.id,
    rawLines,
  });
  if (!legacy) throw new Error("Legacy invoice data is null");

  const mode4 = buildMode4MonthlyInvoiceData({
    mode,
    year: YEAR,
    month: MONTH,
    periodLabel: `${YEAR}年${MONTH}月`,
    customerId: customer.id,
    rawLines,
  });
  if (!mode4) throw new Error("Mode 4 invoice data is null");

  assertEqual(
    mode4.grandTotalAmount,
    legacy.grandTotalAmount,
    "grandTotalAmount"
  );
  assertEqual(
    mode4.taxInvoice.totals.totalInclusive,
    legacy.grandTotalAmount,
    "totalInclusive"
  );
  assertEqual(
    mode4.taxInvoice.totals.subTotalExcludingTax +
      mode4.taxInvoice.totals.sstAmount,
    legacy.grandTotalAmount,
    "subTotal + sst"
  );

  for (const section of mode4.taxInvoice.sections) {
    const listingSection = mode4.listing.sections.find(
      (item) => item.kind === section.kind
    );
    if (!listingSection) {
      throw new Error(`Missing listing section for ${section.kind}`);
    }
    assertEqual(
      listingSection.grandTotal,
      section.totalQty,
      `${section.kind} listing qty vs invoice qty`
    );
  }

  console.log(
    JSON.stringify(
      {
        shipper: customer.name,
        shipperCode: customer.code,
        legacyGrandTotal: legacy.grandTotalAmount,
        mode4GrandTotal: mode4.grandTotalAmount,
        subTotalExcludingTax: mode4.taxInvoice.totals.subTotalExcludingTax,
        sstAmount: mode4.taxInvoice.totals.sstAmount,
        tongQty: mode4.taxInvoice.sections.find((s) => s.kind === "tong")
          ?.totalQty,
        boxQty: mode4.taxInvoice.sections.find((s) => s.kind === "box")
          ?.totalQty,
        lineCount: shipperLines.length,
        myMarketRows:
          mode4.taxInvoice.sections.flatMap((s) => s.myRows).length,
      },
      null,
      2
    )
  );
  console.log("OK: Mode 4 aggregate matches legacy grand total");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
