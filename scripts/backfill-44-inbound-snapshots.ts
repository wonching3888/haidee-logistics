/**
 * Backfill 44 inbound_lines with wrong 1a/THB snapshots (2026-06-15 bug window).
 * HISTORICAL ARCHIVE ONLY — completed 2026-06-17. Do not re-run without restoring
 * temporary hooks (BACKFILL_SKIP_REVALIDATE, __BACKFILL_USER__) removed in chore commit.
 * Not included in next build (see tsconfig exclude: scripts).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";
import type { AppUser } from "../types";
import { decimalToNumber } from "../lib/freight-rates";
import { getMonthDateRange } from "../lib/reports/period-report-shared";
import { getMonthlyInvoiceModeConfig } from "../lib/constants/monthly-invoice";
import { buildMonthlyInvoiceData } from "../lib/monthly-invoice";
import {
  buildPnlCustomerAnalysis,
  buildPnlPeriodSummary,
} from "../lib/pnl-report";

const YEAR = 2026;
const MONTH = 6;
const SESSION_DATE = "2026-06-15";

const TARGET_SHIPPERS = [
  "3000-B002",
  "3002-L002",
  "3002-S006",
  "3002-X001",
  "3002-M002",
];

const EXPECTED_SESSION_NOS = [
  "IN-20260615-016",
  "IN-20260615-022",
  "IN-20260615-023",
  "IN-20260615-042",
  "IN-20260615-043",
  "IN-20260615-044",
  "IN-20260615-045",
  "IN-20260615-049",
];

const BACKUP_PATH = join(
  process.cwd(),
  "scripts",
  "backup-44-rows-before-fix-2026-06-17.json"
);

const PNL_SNAPSHOT_PATH = join(
  process.cwd(),
  "scripts",
  "backup-pnl-before-44-row-fix.json"
);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function stepArg() {
  const arg = process.argv.find((a) => a.startsWith("--step="));
  return arg?.split("=")[1] ?? "all";
}

async function wrongLineWhere() {
  const sessionDate = new Date(`${SESSION_DATE}T00:00:00.000Z`);
  return {
    paymentMode: "1a",
    currency: "THB",
    billingCompany: "haidee",
    session: {
      status: "confirmed" as const,
      date: sessionDate,
      shipper: { code: { in: TARGET_SHIPPERS }, currency: "MYR" },
    },
  };
}

async function fetchWrongLines() {
  return prisma.inboundLine.findMany({
    where: await wrongLineWhere(),
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
    orderBy: [{ session: { sessionNo: "asc" } }, { createdAt: "asc" }],
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

async function stepBackup() {
  const lines = await fetchWrongLines();
  console.log(`\n=== Step 1: Backup (${lines.length} wrong lines) ===`);

  const byShipper: Record<string, number> = {};
  const bySession: Record<string, number> = {};
  for (const l of lines) {
    const code = l.session.shipper.code;
    byShipper[code] = (byShipper[code] ?? 0) + 1;
    const sn = l.session.sessionNo ?? l.sessionId;
    bySession[sn] = (bySession[sn] ?? 0) + 1;
  }
  console.log("By shipper:", byShipper);
  console.log("By session:", bySession);

  const payload = {
    exportedAt: new Date().toISOString(),
    criteria:
      "MYR shippers, payment_mode=1a, currency=THB, billing_company=haidee, session date 2026-06-15 only",
    lineCount: lines.length,
    lines: lines.map(serializeLine),
  };

  writeFileSync(BACKUP_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Backup written: ${BACKUP_PATH}`);

  if (lines.length !== 44) {
    console.warn(`[WARN] Expected 44 lines, found ${lines.length}`);
  }

  const missingSessions = EXPECTED_SESSION_NOS.filter(
    (sn) => !Object.keys(bySession).includes(sn)
  );
  if (missingSessions.length > 0) {
    console.warn("[WARN] Missing expected sessions:", missingSessions);
  }

  return lines;
}

async function capturePnlSnapshot(label: string) {
  const customer = await buildPnlCustomerAnalysis({ year: YEAR, month: MONTH });
  const period = await buildPnlPeriodSummary({ year: YEAR, month: MONTH });
  const shipperRows = TARGET_SHIPPERS.map((code) => {
    const row = customer.customers.find((c) => c.shipperCode === code);
    return row
      ? {
          code,
          revenueMyr: row.revenueMyr,
          totalCostMyr: row.totalCostMyr,
          grossProfitMyr: row.grossProfitMyr,
        }
      : { code, revenueMyr: 0, totalCostMyr: 0, grossProfitMyr: 0 };
  });
  const snapshot = {
    label,
    capturedAt: new Date().toISOString(),
    periodRevenue: period.periodSummary.revenueMyr,
    periodCost: period.periodSummary.costMyr,
    periodProfit: period.periodSummary.grossProfitMyr,
    shippers: shipperRows,
  };
  return snapshot;
}

async function fetchRawInvoiceLinesForMode(mode: "1a" | "1b") {
  const config = getMonthlyInvoiceModeConfig(mode)!;
  const { start, end } = getMonthDateRange(YEAR, MONTH);
  const lines = await prisma.inboundLine.findMany({
    where: {
      paymentMode: config.paymentMode,
      billingCompany: config.billingCompany,
      currency: config.currency,
      freightAmount: { gt: 0 },
      session: { status: "confirmed", date: { gte: start, lte: end } },
    },
    include: {
      session: {
        select: {
          date: true,
          shipper: { select: { id: true, code: true, name: true } },
        },
      },
      stall: { include: { market: { select: { code: true } } } },
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
    isBox: line.isBox,
    shipperId: line.session.shipper.id,
    shipperCode: line.session.shipper.code,
    shipperName: line.session.shipper.name,
    consigneeId: line.consigneeId ?? line.consignee?.id ?? null,
    consigneeCode: line.consignee?.code ?? null,
    consigneeName: line.consignee?.name ?? null,
  }));
}

async function invoiceSummaryForShipper(shipperCode: string) {
  const shipper = await prisma.shipper.findUnique({ where: { code: shipperCode } });
  if (!shipper) return null;

  const modes = ["1a", "1b"] as const;
  const result: Record<string, unknown> = { shipperCode, shipperName: shipper.name, company: shipper.company };

  for (const mode of modes) {
    const raw = await fetchRawInvoiceLinesForMode(mode);
    const shipperLines = raw.filter((l) => l.shipperCode === shipperCode);
    const total = round2(
      shipperLines.reduce((s, l) => s + (l.freightAmount ?? 0), 0)
    );
    result[`mode${mode}LineCount`] = shipperLines.length;
    result[`mode${mode}Total`] = total;

    if (shipperLines.length > 0) {
      try {
        const data = buildMonthlyInvoiceData({
          mode: getMonthlyInvoiceModeConfig(mode)!,
          year: YEAR,
          month: MONTH,
          periodLabel: `${YEAR}年${MONTH}月`,
          customerId: shipper.id,
          rawLines: raw,
        });
        result[`mode${mode}InvoiceTotal`] = data.grandTotalAmount;
        result[`mode${mode}Currency`] = data.currency;
      } catch {
        result[`mode${mode}InvoiceTotal`] = null;
      }
    }
  }

  return result;
}

async function setupAuthMock() {
  const admin =
    (await prisma.user.findFirst({ where: { role: "admin" }, orderBy: { createdAt: "asc" } })) ??
    (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!admin) throw new Error("No user found for auth mock");

  const backfillUser: AppUser = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: "admin",
  };
  (globalThis as { __BACKFILL_USER__?: AppUser }).__BACKFILL_USER__ =
    backfillUser;

  return admin;
}

async function stepResave() {
  console.log("\n=== Step 2: Re-save sessions via saveInboundSession ===");

  if (!existsSync(BACKUP_PATH)) {
    throw new Error(`Backup not found at ${BACKUP_PATH}. Run --step=backup first.`);
  }

  const pnlBefore = await capturePnlSnapshot("before-resave");
  writeFileSync(PNL_SNAPSHOT_PATH, JSON.stringify(pnlBefore, null, 2), "utf8");
  console.log(`P&L before snapshot: ${PNL_SNAPSHOT_PATH}`);

  const wrongLines = await fetchWrongLines();
  if (wrongLines.length === 0) {
    console.log("No wrong lines remain — already fixed?");
    return;
  }

  const sessionIds = Array.from(new Set(wrongLines.map((l) => l.sessionId)));
  const sessions = await prisma.inboundSession.findMany({
    where: { id: { in: sessionIds } },
    include: {
      lines: {
        include: {
          stall: { include: { market: { select: { code: true } } } },
          tongType: { select: { code: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { sessionNo: "asc" },
  });

  await setupAuthMock();
  process.env.BACKFILL_SKIP_REVALIDATE = "1";
  const { saveInboundSession } = await import("../app/actions/inbound");

  const results: Array<{ sessionNo: string; ok: boolean; error?: string }> = [];

  for (const session of sessions) {
    const lines = session.lines
      .filter((l) => l.quantity > 0)
      .map((l) => ({
        stallId: l.stallId,
        tongTypeId: l.tongTypeId,
        quantity: l.quantity,
        lineId: l.id,
        mcDeliveryMode: (l.mcDeliveryMode as "self" | "third_party" | null) ?? undefined,
      }));

    const input = {
      date: session.date.toISOString().slice(0, 10),
      shipperId: session.shipperId,
      thVehiclePlate: session.thVehiclePlate ?? undefined,
      areaNote: session.areaNote ?? undefined,
      pickupLocation: session.pickupLocation,
      lines,
      asDraft: false,
      sessionId: session.id,
    };

    console.log(`\nRe-saving ${session.sessionNo} (${lines.length} lines)...`);
    const result = await saveInboundSession(input);
    results.push({
      sessionNo: session.sessionNo ?? session.id,
      ok: result.ok,
      error: result.ok ? undefined : result.error,
    });
    if (!result.ok) {
      console.error(`  FAIL: ${result.error}`);
    } else {
      console.log("  OK");
    }
  }

  console.log("\nRe-save results:");
  for (const r of results) {
    console.log(`  ${r.ok ? "OK" : "FAIL"} ${r.sessionNo}${r.error ? `: ${r.error}` : ""}`);
  }

  const remaining = await fetchWrongLines();
  console.log(`\nRemaining wrong lines after resave: ${remaining.length}`);

  return results;
}

async function stepVerify() {
  console.log("\n=== Step 3: Verify backfill ===");

  const remaining = await fetchWrongLines();
  console.log(`\n3a. Wrong snapshot lines remaining: ${remaining.length} (expect 0)`);

  const fixedLines = await prisma.inboundLine.findMany({
    where: {
      session: {
        sessionNo: { in: EXPECTED_SESSION_NOS },
      },
    },
    select: {
      id: true,
      paymentMode: true,
      currency: true,
      billingCompany: true,
      freightRate: true,
      freightAmount: true,
      thFreightRate: true,
      mySegmentFreightRate: true,
      session: { select: { sessionNo: true, shipper: { select: { code: true } } } },
    },
  });

  const byShipperFixed: Record<string, { count: number; modes: Set<string>; currencies: Set<string>; billing: Set<string>; totalAmt: number }> = {};
  for (const l of fixedLines) {
    const code = l.session.shipper.code;
    const bucket = byShipperFixed[code] ?? {
      count: 0,
      modes: new Set<string>(),
      currencies: new Set<string>(),
      billing: new Set<string>(),
      totalAmt: 0,
    };
    bucket.count++;
    if (l.paymentMode) bucket.modes.add(l.paymentMode);
    if (l.currency) bucket.currencies.add(l.currency);
    if (l.billingCompany) bucket.billing.add(l.billingCompany);
    bucket.totalAmt = round2(bucket.totalAmt + (decimalToNumber(l.freightAmount) ?? 0));
    byShipperFixed[code] = bucket;
  }

  console.log("\n3b. Fixed session lines by shipper:");
  for (const [code, b] of Object.entries(byShipperFixed)) {
    console.log({
      code,
      lines: b.count,
      paymentModes: [...b.modes],
      currencies: [...b.currencies],
      billingCompanies: [...b.billing],
      freightAmountSum: b.totalAmt,
    });
  }

  console.log("\n3c. Monthly invoice impact:");
  for (const code of TARGET_SHIPPERS) {
    const summary = await invoiceSummaryForShipper(code);
    console.log(summary);
  }

  const mode1aTargets = await prisma.inboundLine.findMany({
    where: {
      paymentMode: "1a",
      currency: "THB",
      billingCompany: "haidee",
      session: {
        status: "confirmed",
        date: {
          gte: new Date(`${SESSION_DATE}T00:00:00.000Z`),
          lte: new Date(`${SESSION_DATE}T23:59:59.999Z`),
        },
        shipper: { code: { in: TARGET_SHIPPERS }, currency: "MYR" },
      },
    },
    select: { id: true, session: { select: { shipper: { select: { code: true } } } } },
  });
  console.log(
    `\n3d. Target shippers still in Mode 1a on ${SESSION_DATE}: ${mode1aTargets.length} lines`
  );

  let pnlBefore: Awaited<ReturnType<typeof capturePnlSnapshot>> | null = null;
  if (existsSync(PNL_SNAPSHOT_PATH)) {
    pnlBefore = JSON.parse(readFileSync(PNL_SNAPSHOT_PATH, "utf8"));
  }
  const pnlAfter = await capturePnlSnapshot("after-resave");

  console.log("\n3e. P&L unchanged check:");
  if (pnlBefore) {
    const revDiff = round2(Math.abs(pnlBefore.periodRevenue - pnlAfter.periodRevenue));
    const costDiff = round2(Math.abs(pnlBefore.periodCost - pnlAfter.periodCost));
    const profitDiff = round2(Math.abs(pnlBefore.periodProfit - pnlAfter.periodProfit));
    console.log(`  Period revenue diff: ${revDiff} ${revDiff <= 0.01 ? "PASS" : "FAIL"}`);
    console.log(`  Period cost diff: ${costDiff} ${costDiff <= 0.01 ? "PASS" : "FAIL"}`);
    console.log(`  Period profit diff: ${profitDiff} ${profitDiff <= 0.01 ? "PASS" : "FAIL"}`);
    for (const code of TARGET_SHIPPERS) {
      const b = pnlBefore.shippers.find((s: { code: string }) => s.code === code);
      const a = pnlAfter.shippers.find((s) => s.code === code);
      if (!b || !a) continue;
      const d = round2(Math.abs(b.revenueMyr - a.revenueMyr));
      console.log(`  ${code} revenue diff: ${d} ${d <= 0.01 ? "PASS" : "FAIL"}`);
    }
  } else {
    console.log("  (no before snapshot — showing after only)");
    console.log(pnlAfter);
  }

  const controlShipper = await prisma.shipper.findFirst({
    where: { code: { notIn: TARGET_SHIPPERS }, currency: "MYR" },
    select: { code: true },
  });
  if (controlShipper) {
    const { start, end } = getMonthDateRange(YEAR, MONTH);
    const controlLines = await prisma.inboundLine.findMany({
      where: {
        session: {
          status: "confirmed",
          date: { gte: start, lte: end },
          shipper: { code: controlShipper.code },
          sessionNo: { notIn: EXPECTED_SESSION_NOS },
        },
      },
      select: { id: true, paymentMode: true, currency: true, modifiedAt: true },
      take: 5,
    });
    console.log(`\n3f. Control shipper ${controlShipper.code} (sample 5 lines, should be untouched by our sessions):`);
    console.log(controlLines);
  }

  if (existsSync(BACKUP_PATH)) {
    const backup = JSON.parse(readFileSync(BACKUP_PATH, "utf8")) as {
      lines: Array<{ id: string; freightAmount: number | null; paymentMode: string | null }>;
    };
    console.log("\n3g. Before/after amount comparison (from backup vs current):");
    for (const code of TARGET_SHIPPERS) {
      const backupRows = backup.lines.filter(
        (l: { shipperCode?: string }) => (l as { shipperCode: string }).shipperCode === code
      );
      const beforeTotal = round2(
        backupRows.reduce((s, r) => s + (r.freightAmount ?? 0), 0)
      );
      const afterTotal = byShipperFixed[code]?.totalAmt ?? 0;
      console.log(`  ${code}: before THB-displayed sum=${beforeTotal} → after MYR sum=${afterTotal}`);
    }
  }
}

async function main() {
  const step = stepArg();
  try {
    if (step === "backup" || step === "all") {
      await stepBackup();
    }
    if (step === "resave" || step === "all") {
      await stepResave();
    }
    if (step === "verify" || step === "all") {
      await stepVerify();
    }
  } catch (e) {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    if (e instanceof Error && e.stack) console.error(e.stack);
    process.exit(1);
  } finally {
    delete (globalThis as { __BACKFILL_USER__?: AppUser }).__BACKFILL_USER__;
    await prisma.$disconnect();
  }
}

main();
