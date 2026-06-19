/**
 * Verify B1-2 crate return monthly billing with June 2026 real GLY/GKS data.
 * Run: npx tsx scripts/_verify-b1-2-crate-return-june.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  aggregateCrateReturnIncomeMyr,
  ensureCrateReturnMonthlyInvoice,
  getCrateReturnMonthlyInvoicePrintData,
} from "../lib/crate-return-billing";
import { aggregateOperationsIncome } from "../lib/operations-income";
import { aggregatePartnerFreightIncomeMyr } from "../lib/partner-freight";
import { buildPnlPeriodSummary } from "../lib/pnl-report";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const YEAR = 2026;
const MONTH = 6;

function assertClose(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 0.001) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

async function main() {
  console.log("=== B1-2 Crate Return June 2026 Verification ===\n");

  const glyImports = await prisma.tongImport.findMany({
    where: {
      date: { gte: new Date("2026-06-01"), lte: new Date("2026-06-30") },
      quantity: { gt: 0 },
      tongType: { code: "GLY" },
    },
    include: { market: true, tongType: true },
  });
  const gksImports = await prisma.tongImport.findMany({
    where: {
      date: { gte: new Date("2026-06-01"), lte: new Date("2026-06-30") },
      quantity: { gt: 0 },
      tongType: { code: "GKS" },
    },
    include: { market: true, tongType: true },
  });

  const glyQty = glyImports.reduce((s, r) => s + r.quantity, 0);
  const gksQty = gksImports.reduce((s, r) => s + r.quantity, 0);
  console.log(`Source data: GLY ${glyQty} crates, GKS ${gksQty} crates`);
  if (glyQty !== 192) {
    console.warn(`  WARN: expected GLY 192, got ${glyQty}`);
  }
  if (gksQty !== 39) {
    console.warn(`  WARN: expected GKS 39, got ${gksQty}`);
  }

  const glyPrint = await ensureCrateReturnMonthlyInvoice(YEAR, MONTH, "GLY");
  const gksPrint = await ensureCrateReturnMonthlyInvoice(YEAR, MONTH, "GKS");

  if (!glyPrint || !gksPrint) {
    throw new Error("ensureCrateReturnMonthlyInvoice returned null");
  }

  console.log("\n--- GLY Invoice ---");
  console.log(`  Invoice No: ${glyPrint.invoiceNo}`);
  console.log(`  Bill-to: ${glyPrint.billToCode} ${glyPrint.billToName}`);
  console.log(`  Address:\n${glyPrint.billToLocation ?? "(none)"}`);
  console.log(`  Qty: ${glyPrint.quantity}`);
  console.log(`  Freight: ${glyPrint.freightAmountMyr} (${glyPrint.freightRateMyr}/crate)`);
  console.log(`  Collection: ${glyPrint.collectionAmountMyr}`);
  console.log(`  Total: ${glyPrint.totalAmountMyr}`);
  console.log(`  Sections: ${glyPrint.sections.map((s) => s.kind).join(", ")}`);

  assertClose(glyPrint.quantity, glyQty, "GLY quantity");
  assertClose(glyPrint.freightAmountMyr, glyQty * 1.5, "GLY freight");
  assertClose(glyPrint.collectionAmountMyr, 0, "GLY collection");
  assertClose(glyPrint.totalAmountMyr, glyQty * 1.5, "GLY total");
  if (glyPrint.sections.length !== 1) {
    throw new Error("GLY should only show freight section (collection rate 0)");
  }
  if (!glyPrint.billToCode.includes("E001")) {
    throw new Error(`GLY bill-to should be Epic Glory E001, got ${glyPrint.billToCode}`);
  }

  console.log("\n--- GKS Invoice ---");
  console.log(`  Invoice No: ${gksPrint.invoiceNo}`);
  console.log(`  Bill-to: ${gksPrint.billToCode} ${gksPrint.billToName}`);
  console.log(`  Address:\n${gksPrint.billToLocation ?? "(none)"}`);
  console.log(`  Qty: ${gksPrint.quantity}`);
  console.log(`  Freight: ${gksPrint.freightAmountMyr} (${gksPrint.freightRateMyr}/crate)`);
  console.log(`  Collection: ${gksPrint.collectionAmountMyr} (${gksPrint.collectionRateMyr}/crate)`);
  console.log(`  Total: ${gksPrint.totalAmountMyr}`);
  console.log(`  Sections: ${gksPrint.sections.map((s) => s.title).join(" | ")}`);

  assertClose(gksPrint.quantity, gksQty, "GKS quantity");
  assertClose(gksPrint.freightAmountMyr, gksQty * 3, "GKS freight");
  assertClose(gksPrint.collectionAmountMyr, gksQty * 1.5, "GKS collection");
  assertClose(gksPrint.totalAmountMyr, gksQty * 4.5, "GKS total");
  if (gksPrint.sections.length !== 2) {
    throw new Error("GKS should show freight + collection sections");
  }
  if (!gksPrint.billToCode.includes("S006")) {
    throw new Error(`GKS bill-to should be Sakda S006, got ${gksPrint.billToCode}`);
  }

  const expectedTotal = glyPrint.totalAmountMyr + gksPrint.totalAmountMyr;
  const aggIncome = await aggregateCrateReturnIncomeMyr(YEAR, MONTH);
  assertClose(aggIncome, expectedTotal, "aggregateCrateReturnIncomeMyr");

  const opsIncome = await aggregateOperationsIncome(YEAR, MONTH);
  assertClose(opsIncome.crateReturnIncomeMyr, expectedTotal, "ops crateReturnIncomeMyr");
  console.log(`\nOperations income crateReturnIncomeMyr: ${opsIncome.crateReturnIncomeMyr}`);
  console.log(`  (partnerFreightMyr unchanged: ${opsIncome.partnerFreightMyr})`);
  console.log(`  (wtlShipperMyr unchanged check: ${opsIncome.wtlShipperMyr})`);

  const pnlTrips = await import("../lib/pnl-report").then((m) =>
    m.buildPnlTripsList({ year: YEAR, month: MONTH })
  );
  assertClose(
    pnlTrips.totals.crateReturnIncomeMyr,
    expectedTotal,
    "P&L tripTotals crateReturnIncomeMyr"
  );
  console.log(`P&L tripTotals crateReturnIncomeMyr: ${pnlTrips.totals.crateReturnIncomeMyr}`);
  console.log(`P&L tripTotals partnerFreightMyr: ${pnlTrips.totals.partnerFreightMyr}`);

  const pnlPeriod = await buildPnlPeriodSummary({
    year: YEAR,
    month: MONTH,
    periodMode: "month",
  });
  console.log(
    `P&L period revenue (includes supplemental): ${pnlPeriod.periodSummary.revenueMyr}`
  );

  const partnerFreight = await aggregatePartnerFreightIncomeMyr(YEAR, MONTH);
  console.log(`Partner freight (independent): ${partnerFreight}`);

  const glyReload = await getCrateReturnMonthlyInvoicePrintData({
    year: YEAR,
    month: MONTH,
    crateType: "GLY",
  });
  const mcRow = glyReload.sections[0]?.rows.find((r) => r.marketCode === "MC");
  console.log(`\nPrint GLY MC row: qty=${mcRow?.quantity}, amount=${mcRow?.amountMyr}`);

  const invoices = await prisma.crateReturnMonthlyInvoice.findMany({
    where: { yearMonth: "2026-06" },
    orderBy: { invoiceNo: "asc" },
  });
  console.log("\nDB invoices for 2026-06:");
  for (const inv of invoices) {
    console.log(
      `  ${inv.invoiceNo} ${inv.crateType} qty=${inv.quantity} total=${inv.totalAmountMyr}`
    );
  }

  console.log("\n=== ALL CHECKS PASSED ===");
  console.log(
    JSON.stringify(
      {
        gly: {
          invoiceNo: glyPrint.invoiceNo,
          qty: glyPrint.quantity,
          freight: glyPrint.freightAmountMyr,
          collection: glyPrint.collectionAmountMyr,
          total: glyPrint.totalAmountMyr,
          billTo: `${glyPrint.billToCode} ${glyPrint.billToName}`,
        },
        gks: {
          invoiceNo: gksPrint.invoiceNo,
          qty: gksPrint.quantity,
          freight: gksPrint.freightAmountMyr,
          collection: gksPrint.collectionAmountMyr,
          total: gksPrint.totalAmountMyr,
          billTo: `${gksPrint.billToCode} ${gksPrint.billToName}`,
        },
        crateReturnIncomeMyr: aggIncome,
        expectedIfSampleData: { gly: 288, gks: 175.5, total: 463.5 },
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
