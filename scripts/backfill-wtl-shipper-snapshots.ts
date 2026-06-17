/**
 * Backfill WTL shipper inbound_lines missing freight snapshots.
 * BS EASTERN 49 lines + BEST BROTHER IN-20260601-030 (7 lines).
 * COMPLETED 2026-06-17. Re-run requires restoring temporary hooks in
 * lib/auth.ts, app/actions/inbound.ts (BACKFILL_SKIP_REVALIDATE, freightRateAsOfDate).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";
import type { AppUser } from "../types";
import { decimalToNumber } from "../lib/freight-rates";
import { getMonthlyInvoiceModeConfig } from "../lib/constants/monthly-invoice";
import { buildMonthlyInvoiceCustomerSummaries } from "../lib/monthly-invoice";
import { getMonthDateRange } from "../lib/reports/period-report-shared";

const RATE_AS_OF_DATE = "2026-06-15";
const YEAR = 2026;
const MONTH = 6;

const TARGET_SESSION_NOS = [
  "IN-20260611-037",
  "IN-20260612-029",
  "IN-20260613-001",
  "IN-20260613-009",
  "IN-20260601-030",
] as const;

const BACKUP_PATH = join(
  process.cwd(),
  "scripts",
  "backup-wtl-shipper-snapshots-2026-06-17.json"
);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function stepArg() {
  const arg = process.argv.find((a) => a.startsWith("--step="));
  return arg?.split("=")[1] ?? "all";
}

async function fetchTargetLines() {
  return prisma.inboundLine.findMany({
    where: {
      OR: [{ freightAmount: null }, { freightAmount: 0 }],
      session: {
        status: "confirmed",
        sessionNo: { in: [...TARGET_SESSION_NOS] },
      },
    },
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
          shipper: {
            select: { code: true, name: true, currency: true, company: true },
          },
        },
      },
      stall: { include: { market: { select: { code: true } } } },
      tongType: { select: { code: true, isBox: true } },
      dispatchLines: {
        select: {
          dispatchOrder: { select: { id: true, date: true, status: true } },
        },
      },
    },
    orderBy: [{ session: { sessionNo: "asc" } }, { createdAt: "asc" }],
  });
}

function serializeLine(line: Awaited<ReturnType<typeof fetchTargetLines>>[number]) {
  return {
    id: line.id,
    sessionId: line.sessionId,
    sessionNo: line.session.sessionNo,
    sessionDate: line.session.date.toISOString().slice(0, 10),
    shipperCode: line.session.shipper.code,
    stallId: line.stallId,
    tongTypeId: line.tongTypeId,
    quantity: line.quantity,
    dispatchStatus: line.dispatchStatus,
    paymentMode: line.paymentMode,
    currency: line.currency,
    billingCompany: line.billingCompany,
    freightAmount: decimalToNumber(line.freightAmount),
    thFreightAmount: decimalToNumber(line.thFreightAmount),
    mySegmentFreightAmount: decimalToNumber(line.mySegmentFreightAmount),
    dispatchOrders: line.dispatchLines.map((dl) => ({
      date: dl.dispatchOrder.date.toISOString().slice(0, 10),
      status: dl.dispatchOrder.status,
    })),
  };
}

async function setupAuthMock() {
  const admin =
    (await prisma.user.findFirst({
      where: { role: "admin" },
      orderBy: { createdAt: "asc" },
    })) ??
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
  const lines = await fetchTargetLines();
  console.log(`\n=== Backup: ${lines.length} target lines ===`);

  const payload = {
    exportedAt: new Date().toISOString(),
    sessionNos: TARGET_SESSION_NOS,
    lineCount: lines.length,
    lines: lines.map(serializeLine),
  };

  writeFileSync(BACKUP_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Backup written: ${BACKUP_PATH}`);

  const bySession = new Map<string, number>();
  for (const l of lines) {
    const key = l.session.sessionNo ?? "?";
    bySession.set(key, (bySession.get(key) ?? 0) + 1);
  }
  console.log("Lines per session:", Object.fromEntries(bySession));

  return lines;
}

async function stepResave() {
  const sessionIds = Array.from(
    new Set(
      (
        await prisma.inboundSession.findMany({
          where: { sessionNo: { in: [...TARGET_SESSION_NOS] } },
          select: { id: true },
        })
      ).map((s) => s.id)
    )
  );

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

  for (const session of sessions) {
    const lines = session.lines
      .filter((l) => l.quantity > 0)
      .map((l) => ({
        stallId: l.stallId,
        tongTypeId: l.tongTypeId,
        quantity: l.quantity,
        lineId: l.id,
        mcDeliveryMode:
          (l.mcDeliveryMode as "self" | "third_party" | null) ?? undefined,
      }));

    console.log(
      `\nRe-saving ${session.sessionNo} (${lines.length} lines) rates as of ${RATE_AS_OF_DATE}...`
    );
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
  }
}

async function stepVerify() {
  console.log("\n=== Verify backfill ===");

  const remaining = await fetchTargetLines();
  console.log(`Remaining null/zero freight lines: ${remaining.length} (expect 0)`);

  const { start, end } = getMonthDateRange(YEAR, MONTH);
  const mode4Lines = await prisma.inboundLine.findMany({
    where: {
      billingCompany: "wtl",
      currency: "MYR",
      paymentMode: { not: "3" },
      freightAmount: { gt: 0 },
      session: {
        status: "confirmed",
        date: { gte: start, lte: end },
        sessionNo: { in: [...TARGET_SESSION_NOS] },
      },
    },
    select: {
      freightAmount: true,
      thFreightAmount: true,
      mySegmentFreightAmount: true,
      session: { select: { sessionNo: true, shipper: { select: { code: true } } } },
    },
  });

  const byShipper = new Map<string, { lines: number; freight: number }>();
  for (const l of mode4Lines) {
    const code = l.session.shipper.code;
    const bucket = byShipper.get(code) ?? { lines: 0, freight: 0 };
    bucket.lines += 1;
    bucket.freight = round2(
      bucket.freight + (decimalToNumber(l.freightAmount) ?? 0)
    );
    byShipper.set(code, bucket);
  }

  console.log("\nMode 4 eligible lines from target sessions (June):");
  for (const [code, stats] of byShipper) {
    console.log(`  ${code}: ${stats.lines} lines, ${stats.freight} MYR`);
  }

  const config = getMonthlyInvoiceModeConfig("4")!;
  const juneMode4 = await prisma.inboundLine.findMany({
    where: {
      billingCompany: "wtl",
      currency: "MYR",
      paymentMode: { not: "3" },
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

  const rawLines = juneMode4.map((line) => ({
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

  const customers = buildMonthlyInvoiceCustomerSummaries(rawLines, config);
  console.log("\nMode 4 customer list (June):");
  for (const c of customers) {
    if (c.customerCode === "3000-B001" || c.customerCode === "3000-B002") {
      console.log(
        `  ${c.customerCode} ${c.customerName}: ${c.lineCount} lines, ${c.grandTotal} MYR`
      );
    }
  }

  const session030 = await prisma.inboundLine.findMany({
    where: { session: { sessionNo: "IN-20260601-030" } },
    include: {
      dispatchLines: {
        select: {
          dispatchOrder: { select: { date: true, status: true } },
        },
      },
    },
  });
  console.log("\nIN-20260601-030 dispatch vs session date (ops report eligibility):");
  for (const l of session030) {
    const doDates = l.dispatchLines.map(
      (dl) => dl.dispatchOrder.date.toISOString().slice(0, 10)
    );
    console.log({
      id: l.id.slice(0, 8),
      dispatchStatus: l.dispatchStatus,
      freight: decimalToNumber(l.freightAmount),
      dispatchOrderDates: doDates,
      inJuneOpsQuery:
        l.dispatchStatus === "assigned" &&
        doDates.some((d) => d >= "2026-06-01" && d <= "2026-06-30"),
    });
  }

  const { aggregateOperationsIncome } = await import("../lib/operations-income");
  const income = await aggregateOperationsIncome(YEAR, MONTH);
  console.log("\nJune operations income after backfill:");
  console.log({
    wtlShipperMyr: income.wtlShipperMyr,
    mode1bMyr: income.mode1bMyr,
  });
}

async function main() {
  const step = stepArg();
  try {
    if (step === "backup" || step === "all") await stepBackup();
    if (step === "resave" || step === "all") await stepResave();
    if (step === "verify" || step === "all") await stepVerify();
  } finally {
    delete (globalThis as { __BACKFILL_USER__?: AppUser }).__BACKFILL_USER__;
    delete process.env.BACKFILL_SKIP_REVALIDATE;
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
