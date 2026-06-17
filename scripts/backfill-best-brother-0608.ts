/**
 * Backfill 10 BEST BROTHER inbound_lines (IN-20260608-001).
 * HISTORICAL ARCHIVE ONLY — completed 2026-06-17. Do not re-run without restoring
 * temporary hooks (BACKFILL_SKIP_REVALIDATE, freightRateAsOfDate, __BACKFILL_USER__).
 * Not included in next build (see tsconfig exclude: scripts).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";
import type { AppUser } from "../types";
import { decimalToNumber } from "../lib/freight-rates";
import { buildPnlCustomerAnalysis, buildPnlPeriodSummary } from "../lib/pnl-report";

const SHIPPER_CODE = "3000-B002";
const SESSION_NO = "IN-20260608-001";
const SESSION_DATE = "2026-06-08";
const YEAR = 2026;
const MONTH = 6;

const BACKUP_PATH = join(
  process.cwd(),
  "scripts",
  "backup-10-rows-best-brother-0608-2026-06-17.json"
);

const PNL_SNAPSHOT_PATH = join(
  process.cwd(),
  "scripts",
  "backup-pnl-before-best-brother-0608-fix.json"
);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function stepArg() {
  const arg = process.argv.find((a) => a.startsWith("--step="));
  return arg?.split("=")[1] ?? "all";
}

function wrongLineWhere() {
  return {
    paymentMode: "1a",
    currency: "THB",
    billingCompany: "haidee",
    session: {
      status: "confirmed" as const,
      sessionNo: SESSION_NO,
      shipper: { code: SHIPPER_CODE, currency: "MYR" },
    },
  };
}

async function fetchWrongLines() {
  return prisma.inboundLine.findMany({
    where: wrongLineWhere(),
    include: {
      session: {
        select: {
          id: true,
          sessionNo: true,
          date: true,
          status: true,
          shipperId: true,
          thVehiclePlate: true,
          areaNote: true,
          pickupLocation: true,
          shipper: { select: { code: true, name: true, currency: true, company: true } },
        },
      },
      stall: { include: { market: { select: { code: true } } } },
      tongType: { select: { code: true, isBox: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

function serializeLine(line: Awaited<ReturnType<typeof fetchWrongLines>>[number]) {
  return {
    id: line.id,
    sessionId: line.sessionId,
    stallId: line.stallId,
    tongTypeId: line.tongTypeId,
    quantity: line.quantity,
    isBox: line.isBox,
    dispatchStatus: line.dispatchStatus,
    truckId: line.truckId,
    originalQuantity: line.originalQuantity,
    originalTongTypeId: line.originalTongTypeId,
    originalStallId: line.originalStallId,
    modifiedAt: line.modifiedAt?.toISOString() ?? null,
    createdAt: line.createdAt.toISOString(),
    consigneeId: line.consigneeId,
    paymentParty: line.paymentParty,
    paymentMode: line.paymentMode,
    currency: line.currency,
    billingCompany: line.billingCompany,
    freightRate: decimalToNumber(line.freightRate),
    freightAmount: decimalToNumber(line.freightAmount),
    exchangeRate: decimalToNumber(line.exchangeRate),
    mcDeliveryMode: line.mcDeliveryMode,
    thirdPartyFee: decimalToNumber(line.thirdPartyFee),
    mySegmentFreightRate: decimalToNumber(line.mySegmentFreightRate),
    mySegmentFreightAmount: decimalToNumber(line.mySegmentFreightAmount),
    thFreightRate: decimalToNumber(line.thFreightRate),
    thFreightAmount: decimalToNumber(line.thFreightAmount),
    sessionNo: line.session.sessionNo,
    sessionDate: line.session.date.toISOString().slice(0, 10),
    shipperCode: line.session.shipper.code,
    shipperName: line.session.shipper.name,
    stallCode: line.stall.code,
    marketCode: line.stall.market?.code ?? "",
    tongTypeCode: line.tongType.code,
  };
}

async function capturePnlSnapshot(label: string) {
  const customer = await buildPnlCustomerAnalysis({ year: YEAR, month: MONTH });
  const period = await buildPnlPeriodSummary({ year: YEAR, month: MONTH });
  const row = customer.customers.find((c) => c.shipperCode === SHIPPER_CODE);
  return {
    label,
    capturedAt: new Date().toISOString(),
    periodRevenue: period.periodSummary.revenueMyr,
    periodCost: period.periodSummary.costMyr,
    periodProfit: period.periodSummary.grossProfitMyr,
    bestBrother: row
      ? {
          revenueMyr: row.revenueMyr,
          totalCostMyr: row.totalCostMyr,
          grossProfitMyr: row.grossProfitMyr,
        }
      : null,
  };
}

const RATE_AS_OF_DATE = "2026-06-15";

async function stepConfirmRates() {
  const shipper = await prisma.shipper.findUnique({
    where: { code: SHIPPER_CODE },
    select: { id: true, name: true },
  });
  if (!shipper) throw new Error("Shipper not found");

  const rates = await prisma.freightRate.findMany({
    where: {
      shipperId: shipper.id,
      effectiveDate: new Date(`${RATE_AS_OF_DATE}T00:00:00.000Z`),
    },
    include: { market: { select: { code: true } } },
    orderBy: { market: { code: "asc" } },
  });

  console.log(`\n=== Step 1: Confirm freight_rates (${RATE_AS_OF_DATE}) ===`);
  console.log(`BEST BROTHER rates on ${RATE_AS_OF_DATE}: ${rates.length} markets`);
  for (const r of rates) {
    console.log({
      market: r.market?.code,
      currency: r.currency,
      rateTong: decimalToNumber(r.rateTong),
      rateBox: decimalToNumber(r.rateBox),
      rateTongThai: decimalToNumber(r.rateTongThai),
      isWtl: r.isWtl,
    });
  }
  return rates;
}

async function setupAuthMock() {
  const admin =
    (await prisma.user.findFirst({ where: { role: "admin" }, orderBy: { createdAt: "asc" } })) ??
    (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!admin) throw new Error("No user found for auth mock");

  (globalThis as { __BACKFILL_USER__?: AppUser }).__BACKFILL_USER__ = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: "admin",
  };
}

async function stepBackup() {
  const lines = await fetchWrongLines();
  console.log(`\n=== Step 1: Backup (${lines.length} wrong lines) ===`);
  console.log(`Session: ${SESSION_NO}`);

  const payload = {
    exportedAt: new Date().toISOString(),
    criteria: `BEST BROTHER ${SESSION_NO}, payment_mode=1a, currency=THB, billing_company=haidee`,
    lineCount: lines.length,
    lines: lines.map(serializeLine),
  };

  writeFileSync(BACKUP_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Backup written: ${BACKUP_PATH}`);

  if (lines.length !== 10) {
    console.warn(`[WARN] Expected 10 lines, found ${lines.length}`);
  }

  const beforeTotal = round2(
    lines.reduce((s, l) => s + (decimalToNumber(l.freightAmount) ?? 0), 0)
  );
  console.log(`Before freight_amount sum: ${beforeTotal}`);

  return lines;
}

async function stepResave() {
  console.log("\n=== Step 2: Re-save via saveInboundSession (freight rates as of 2026-06-15) ===");

  const pnlBefore = await capturePnlSnapshot("before-freight-fill");
  writeFileSync(PNL_SNAPSHOT_PATH, JSON.stringify(pnlBefore, null, 2), "utf8");
  console.log(`P&L before snapshot: ${PNL_SNAPSHOT_PATH}`);
  console.log("BEST BROTHER P&L before:", pnlBefore.bestBrother);

  const session = await prisma.inboundSession.findFirst({
    where: { sessionNo: SESSION_NO },
    include: {
      lines: {
        include: {
          stall: { include: { market: { select: { code: true } } } },
          tongType: { select: { code: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!session) throw new Error(`Session not found: ${SESSION_NO}`);

  await setupAuthMock();
  process.env.BACKFILL_SKIP_REVALIDATE = "1";
  const { saveInboundSession } = await import("../app/actions/inbound");

  const lines = session.lines
    .filter((l) => l.quantity > 0)
    .map((l) => ({
      stallId: l.stallId,
      tongTypeId: l.tongTypeId,
      quantity: l.quantity,
      lineId: l.id,
      mcDeliveryMode: (l.mcDeliveryMode as "self" | "third_party" | null) ?? undefined,
    }));

  console.log(`\nRe-saving ${session.sessionNo} (${lines.length} lines) with freight rates as of ${RATE_AS_OF_DATE}...`);
  const result = await saveInboundSession({
    date: session.date.toISOString().slice(0, 10),
    shipperId: session.shipperId,
    thVehiclePlate: session.thVehiclePlate ?? undefined,
    areaNote: session.areaNote ?? undefined,
    pickupLocation: session.pickupLocation,
    lines,
    asDraft: false,
    sessionId: session.id,
    freightRateAsOfDate: RATE_AS_OF_DATE,
  });

  console.log(result.ok ? "  OK" : `  FAIL: ${result.error}`);

  const nullFreight = await prisma.inboundLine.count({
    where: { session: { sessionNo: SESSION_NO }, freightAmount: null },
  });
  console.log(`Lines with null freight_amount after resave: ${nullFreight}`);
}

async function stepVerify() {
  console.log("\n=== Step 3: Verify ===");

  const fixedLines = await prisma.inboundLine.findMany({
    where: { session: { sessionNo: SESSION_NO } },
    select: {
      id: true,
      paymentMode: true,
      currency: true,
      billingCompany: true,
      freightRate: true,
      freightAmount: true,
      thFreightRate: true,
      thFreightAmount: true,
      mySegmentFreightRate: true,
      mySegmentFreightAmount: true,
      quantity: true,
      stall: { select: { market: { select: { code: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const wtlPopulated = fixedLines.filter(
    (l) =>
      decimalToNumber(l.thFreightRate) != null &&
      decimalToNumber(l.mySegmentFreightRate) != null &&
      decimalToNumber(l.freightAmount) != null
  );

  const withFreight = fixedLines.filter(
    (l) => decimalToNumber(l.freightAmount) != null && decimalToNumber(l.freightAmount)! > 0
  );

  console.log(`\n3a. Session ${SESSION_NO}: ${fixedLines.length} lines`);
  console.log({
    paymentModes: [...new Set(fixedLines.map((l) => l.paymentMode))],
    currencies: [...new Set(fixedLines.map((l) => l.currency))],
    billingCompanies: [...new Set(fixedLines.map((l) => l.billingCompany))],
    wtlDualSegmentPopulated: `${wtlPopulated.length}/${fixedLines.length}`,
    withFreightAmount: `${withFreight.length}/${fixedLines.length}`,
  });

  console.log("\nSample fixed lines:");
  for (const l of fixedLines.slice(0, 3)) {
    console.log({
      market: l.stall.market?.code,
      qty: l.quantity,
      paymentMode: l.paymentMode,
      currency: l.currency,
      billingCompany: l.billingCompany,
      freightRate: decimalToNumber(l.freightRate),
      freightAmount: decimalToNumber(l.freightAmount),
      thFreightRate: decimalToNumber(l.thFreightRate),
      thFreightAmount: decimalToNumber(l.thFreightAmount),
      mySegmentFreightRate: decimalToNumber(l.mySegmentFreightRate),
      mySegmentFreightAmount: decimalToNumber(l.mySegmentFreightAmount),
    });
  }

  const afterTotal = round2(
    fixedLines.reduce((s, l) => s + (decimalToNumber(l.freightAmount) ?? 0), 0)
  );

  let beforeTotal = 0;
  if (existsSync(BACKUP_PATH)) {
    const backup = JSON.parse(readFileSync(BACKUP_PATH, "utf8")) as {
      lines: Array<{ freightAmount: number | null }>;
    };
    beforeTotal = round2(
      backup.lines.reduce((s, r) => s + (r.freightAmount ?? 0), 0)
    );
  }

  console.log(`\n3c. Amount comparison:`);
  console.log(`  Before (wrong 1a/THB label): ${beforeTotal}`);
  console.log(`  After (correct MYR/WTL):     ${afterTotal}`);

  let pnlBefore: Awaited<ReturnType<typeof capturePnlSnapshot>> | null = null;
  if (existsSync(PNL_SNAPSHOT_PATH)) {
    pnlBefore = JSON.parse(readFileSync(PNL_SNAPSHOT_PATH, "utf8"));
  }
  const pnlAfter = await capturePnlSnapshot("after-resave");

  console.log(`\n3d. P&L unchanged check:`);
  if (pnlBefore?.bestBrother && pnlAfter.bestBrother) {
    const revDiff = round2(
      Math.abs(pnlBefore.bestBrother.revenueMyr - pnlAfter.bestBrother.revenueMyr)
    );
    const costDiff = round2(
      Math.abs(pnlBefore.bestBrother.totalCostMyr - pnlAfter.bestBrother.totalCostMyr)
    );
    const profitDiff = round2(
      Math.abs(pnlBefore.bestBrother.grossProfitMyr - pnlAfter.bestBrother.grossProfitMyr)
    );
    const periodRevDiff = round2(
      Math.abs(pnlBefore.periodRevenue - pnlAfter.periodRevenue)
    );
    console.log(`  BEST BROTHER revenue diff: ${revDiff} ${revDiff <= 0.01 ? "PASS" : "FAIL"}`);
    console.log(`  BEST BROTHER cost diff: ${costDiff} ${costDiff <= 0.01 ? "PASS" : "FAIL"}`);
    console.log(`  BEST BROTHER profit diff: ${profitDiff} ${profitDiff <= 0.01 ? "PASS" : "FAIL"}`);
    console.log(`  June period revenue diff: ${periodRevDiff} ${periodRevDiff <= 0.01 ? "PASS" : "FAIL"}`);
    console.log("  Before:", pnlBefore.bestBrother);
    console.log("  After: ", pnlAfter.bestBrother);
  } else {
    console.log("  (no before snapshot)");
    console.log("  After:", pnlAfter.bestBrother);
  }

  const otherSessions = await prisma.inboundSession.findMany({
    where: {
      status: "confirmed",
      date: new Date(`${SESSION_DATE}T00:00:00.000Z`),
      sessionNo: { not: SESSION_NO },
    },
    select: {
      sessionNo: true,
      lines: {
        select: { paymentMode: true, currency: true, modifiedAt: true },
        take: 2,
      },
    },
    take: 3,
  });
  console.log(`\n3e. Other sessions on ${SESSION_DATE} (sample, should be untouched):`);
  console.log(otherSessions);
}

async function main() {
  const step = stepArg();
  try {
    if (step === "rates" || step === "all") await stepConfirmRates();
    if (step === "backup" || step === "all") await stepBackup();
    if (step === "resave" || step === "all") await stepResave();
    if (step === "verify" || step === "all") await stepVerify();
  } catch (e) {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  } finally {
    delete (globalThis as { __BACKFILL_USER__?: AppUser }).__BACKFILL_USER__;
    await prisma.$disconnect();
  }
}

main();
