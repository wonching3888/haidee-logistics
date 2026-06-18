/**
 * Backfill 660 pre-Phase-1.5b inbound lines (197 sessions, 6/10-6/13 mostly).
 * HISTORICAL ARCHIVE ONLY — completed 2026-06-18. Re-run requires restoring
 * temporary hooks (BACKFILL_SKIP_REVALIDATE, freightRateAsOfDate, __BACKFILL_USER__)
 * removed in the cleanup commit after this backfill.
 * Run: node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/backfill-660-pre-1.5b-snapshots.ts --step=all
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";
import type { AppUser } from "../types";
import { decimalToNumber } from "../lib/freight-rates";
import { getMonthDateRange } from "../lib/reports/period-report-shared";
import {
  classifyInboundFreightGap,
  computeInboundLineFreight,
  normalizeMcDeliveryMode,
} from "../lib/inbound-freight";
import { loadInboundFreightContext } from "../lib/freight-context";
import { resolveSessionPickupLocation } from "../lib/constants/pickup-locations";

const YEAR = 2026;
const MONTH = 6;
const RATE_AS_OF_DATE = "2026-06-15";

const BACKUP_PATH = join(
  process.cwd(),
  "scripts",
  "backup-660-rows-pre-1.5b-2026-06-17.json"
);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function stepArg() {
  const arg = process.argv.find((a) => a.startsWith("--step="));
  return arg?.split("=")[1] ?? "all";
}

function targetLineWhere() {
  const { start, end } = getMonthDateRange(YEAR, MONTH);
  return {
    session: { status: "confirmed" as const, date: { gte: start, lte: end } },
    dispatchStatus: "assigned" as const,
    freightAmount: null,
    paymentMode: null,
    currency: null,
    billingCompany: null,
  };
}

function serializeLine(line: Awaited<ReturnType<typeof fetchTargetLines>>[number]) {
  return {
    id: line.id,
    sessionId: line.sessionId,
    sessionNo: line.session.sessionNo,
    sessionDate: line.session.date.toISOString().slice(0, 10),
    shipperCode: line.session.shipper.code,
    shipperName: line.session.shipper.name,
    marketCode: line.stall.market?.code ?? "",
    stallCode: line.stall.code,
    tongTypeCode: line.tongType.code,
    quantity: line.quantity,
    isBox: line.isBox,
    dispatchStatus: line.dispatchStatus,
    paymentMode: line.paymentMode,
    currency: line.currency,
    billingCompany: line.billingCompany,
    freightRate: decimalToNumber(line.freightRate),
    freightAmount: decimalToNumber(line.freightAmount),
    thFreightRate: decimalToNumber(line.thFreightRate),
    thFreightAmount: decimalToNumber(line.thFreightAmount),
    mySegmentFreightRate: decimalToNumber(line.mySegmentFreightRate),
    mySegmentFreightAmount: decimalToNumber(line.mySegmentFreightAmount),
    mcDeliveryMode: line.mcDeliveryMode,
    createdAt: line.createdAt.toISOString(),
  };
}

async function fetchTargetLines() {
  return prisma.inboundLine.findMany({
    where: targetLineWhere(),
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
          shipperCurrency: true,
          shipper: { select: { code: true, name: true, pickupLocation: true } },
        },
      },
      stall: { include: { market: { select: { code: true } } } },
      tongType: { select: { code: true, isBox: true } },
    },
    orderBy: [{ session: { date: "asc" } }, { createdAt: "asc" }],
  });
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
  const sessionIds = [...new Set(lines.map((l) => l.sessionId))];

  console.log(`\n=== Backup: ${lines.length} lines, ${sessionIds.length} sessions ===`);

  const payload = {
    exportedAt: new Date().toISOString(),
    criteria:
      "June 2026 assigned lines with null payment_mode/currency/billing_company and null freight_amount (pre-Phase-1.5b)",
    lineCount: lines.length,
    sessionCount: sessionIds.length,
    sessionNos: [...new Set(lines.map((l) => l.session.sessionNo).filter(Boolean))],
    lines: lines.map(serializeLine),
  };

  writeFileSync(BACKUP_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Backup written: ${BACKUP_PATH}`);

  const beforeTotal = round2(
    lines.reduce((s, l) => s + (decimalToNumber(l.freightAmount) ?? 0), 0)
  );
  console.log(`Before freight_amount sum: ${beforeTotal}`);

  return { lines, sessionIds };
}

async function stepResave() {
  if (!existsSync(BACKUP_PATH)) {
    throw new Error(`Backup not found at ${BACKUP_PATH}. Run --step=backup first.`);
  }

  const backup = JSON.parse(readFileSync(BACKUP_PATH, "utf8")) as {
    sessionCount: number;
  };
  const sessionIds = [
    ...new Set(
      (
        await fetchTargetLines()
      ).map((l) => l.sessionId)
    ),
  ];

  if (sessionIds.length === 0) {
    console.log("No target sessions remain — already fixed?");
    return;
  }

  console.log(
    `\n=== Re-save ${sessionIds.length} sessions (expected ${backup.sessionCount}) with freightRateAsOfDate=${RATE_AS_OF_DATE} ===`
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

  const results: Array<{ sessionNo: string; ok: boolean; error?: string }> = [];

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

    try {
      const result = await saveInboundSession({
        date: session.date.toISOString().slice(0, 10),
        shipperId: session.shipperId,
        thVehiclePlate: session.thVehiclePlate ?? undefined,
        areaNote: session.areaNote ?? undefined,
        pickupLocation: session.pickupLocation,
        lines,
        asDraft: false,
        sessionId: session.id,
      });
      results.push({
        sessionNo: session.sessionNo ?? session.id,
        ok: result.ok,
        error: result.ok ? undefined : result.error,
      });
      console.log(
        result.ok
          ? `  OK ${session.sessionNo}`
          : `  FAIL ${session.sessionNo}: ${result.error}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        sessionNo: session.sessionNo ?? session.id,
        ok: false,
        error: message,
      });
      console.log(`  FAIL ${session.sessionNo}: ${message}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nResave complete: ${results.length - failed.length}/${results.length} OK`);
  if (failed.length) {
    console.log("Failed sessions:", failed);
  }
}

async function stepVerify() {
  console.log("\n=== Verify ===");

  const backup = JSON.parse(readFileSync(BACKUP_PATH, "utf8")) as {
    lines: Array<{ id: string }>;
  };
  const targetIds = backup.lines.map((l) => l.id);

  const afterLines = await prisma.inboundLine.findMany({
    where: { id: { in: targetIds } },
    include: {
      session: {
        select: {
          sessionNo: true,
          shipper: { select: { code: true, name: true } },
        },
      },
      stall: { include: { market: { select: { code: true } } } },
      tongType: { select: { isBox: true } },
    },
  });

  const withTags = afterLines.filter(
    (l) => l.paymentMode && l.currency && l.billingCompany
  );
  const withFreight = afterLines.filter(
    (l) => decimalToNumber(l.freightAmount) != null && decimalToNumber(l.freightAmount)! > 0
  );
  const stillNullFreight = afterLines.filter((l) => l.freightAmount == null);
  const freightSum = round2(
    afterLines.reduce((s, l) => s + (decimalToNumber(l.freightAmount) ?? 0), 0)
  );

  console.log(`Target lines: ${targetIds.length}`);
  console.log(`With payment tags: ${withTags.length}/${afterLines.length}`);
  console.log(`With freight_amount > 0: ${withFreight.length}/${afterLines.length}`);
  console.log(`Still null freight_amount: ${stillNullFreight.length}`);
  console.log(`Freight_amount sum (all target lines): ${freightSum}`);

  const rateAsOf = new Date(`${RATE_AS_OF_DATE}T00:00:00.000Z`);
  const gapMap = new Map<
    string,
    { shipper: string; market: string; reason: string; count: number }
  >();

  for (const line of stillNullFreight) {
    const session = await prisma.inboundSession.findUnique({
      where: { id: line.sessionId },
      select: {
        shipperId: true,
        date: true,
        pickupLocation: true,
        shipper: { select: { pickupLocation: true } },
      },
    });
    if (!session) continue;

    const effectivePickup = resolveSessionPickupLocation(
      session.pickupLocation,
      session.shipper.pickupLocation
    );

    const { ctx } = await loadInboundFreightContext(
      session.shipperId,
      [line.stallId],
      [line.tongTypeId],
      rateAsOf,
      effectivePickup
    );

    const market = line.stall.market?.code ?? "";
    const snap = computeInboundLineFreight(
      {
        stallId: line.stallId,
        tongTypeId: line.tongTypeId,
        quantity: line.quantity,
        mcDeliveryMode: normalizeMcDeliveryMode(market, line.mcDeliveryMode),
      },
      ctx
    );
    const gap =
      classifyInboundFreightGap(
        {
          stallId: line.stallId,
          tongTypeId: line.tongTypeId,
          quantity: line.quantity,
          mcDeliveryMode: normalizeMcDeliveryMode(market, line.mcDeliveryMode),
        },
        ctx,
        snap
      ) ?? "unknown";

    const shipperCode =
      afterLines.find((l) => l.id === line.id)?.session.shipper.code ?? "?";
    const key = `${shipperCode}|${market}|${gap}`;
    const existing = gapMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      gapMap.set(key, {
        shipper: shipperCode,
        market,
        reason: gap,
        count: 1,
      });
    }
  }

  if (gapMap.size > 0) {
    console.log("\nStill unfillable after 6/15 rates (config gaps):");
    const sorted = [...gapMap.values()].sort((a, b) => b.count - a.count);
    for (const row of sorted) {
      console.log(
        `  ${row.shipper} / ${row.market} — ${row.reason} (${row.count} lines)`
      );
    }
    console.log(`Total unfillable lines: ${stillNullFreight.length}`);
  }

  // Scope: other June lines unchanged (sample backup ids vs current non-target)
  const { start, end } = getMonthDateRange(YEAR, MONTH);
  const otherJune = await prisma.inboundLine.count({
    where: {
      session: { status: "confirmed", date: { gte: start, lte: end } },
      id: { notIn: targetIds },
    },
  });
  console.log(`\nOther June lines (unchanged set size): ${otherJune}`);
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
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
