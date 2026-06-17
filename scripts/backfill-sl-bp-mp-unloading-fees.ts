/**
 * Backfill unloading_fee for trips with SL/BP/MP cargo (KL sub-markets).
 * Bug: base unload fee was 0 because table B had no SL/BP/MP rows (!rate).
 * Fix: SL/BP/MP use KL rates + KL unload/KPB rules (see unloading-calculator.ts).
 *
 * Usage: npx tsx scripts/backfill-sl-bp-mp-unloading-fees.ts [--step=audit|backup|recalc|verify|all]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";

const KL_SUB_MARKETS = ["SL", "BP", "MP"] as const;
const BACKUP_PATH = join(
  process.cwd(),
  "scripts",
  "backup-sl-bp-mp-unloading-fees-2026-06-17.json"
);
const PNL_SNAPSHOT_PATH = join(
  process.cwd(),
  "scripts",
  "backup-pnl-unload-before-sl-bp-mp-fix.json"
);

type UnloadingFeeRow = Awaited<
  ReturnType<PrismaClient["unloadingFee"]["findMany"]>
>[number];

type Deps = {
  prisma: PrismaClient;
  getMonthDateRange: typeof import("../lib/reports/period-report-shared").getMonthDateRange;
  buildPnlPeriodSummary: typeof import("../lib/pnl-report").buildPnlPeriodSummary;
  buildPnlTripDetail: typeof import("../lib/pnl-report").buildPnlTripDetail;
  generateUnloadingFeesForTrip: typeof import("../lib/driver-expense-service").generateUnloadingFeesForTrip;
  effectiveKpbFee: typeof import("../lib/unloading-calculator").effectiveKpbFee;
  effectiveUnloadFee: typeof import("../lib/unloading-calculator").effectiveUnloadFee;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function stepArg() {
  const arg = process.argv.find((a) => a.startsWith("--step="));
  return arg?.split("=")[1] ?? "all";
}

function rowSubtotal(
  row: {
    unloadFee: number;
    unloadFeeOverride: number | null;
    kpbFee: number;
    kpbFeeOverride: number | null;
    isKpbExempt: boolean;
  },
  deps: Pick<Deps, "effectiveKpbFee" | "effectiveUnloadFee">
) {
  return round2(
    deps.effectiveUnloadFee(row) + deps.effectiveKpbFee(row)
  );
}

async function findAffectedTripIds(deps: Deps) {
  return deps.prisma.dispatchOrder.findMany({
    where: {
      status: { notIn: ["draft", "cancelled"] },
      lines: {
        some: {
          inboundLine: {
            dispatchStatus: "assigned",
            stall: { market: { code: { in: [...KL_SUB_MARKETS] } } },
          },
        },
      },
    },
    select: {
      id: true,
      date: true,
      driverName: true,
      truck: { select: { plate: true } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
}

async function fetchUnloadingFeesForTrips(deps: Deps, tripIds: string[]) {
  if (tripIds.length === 0) return [];
  return deps.prisma.unloadingFee.findMany({
    where: { tripId: { in: tripIds } },
    orderBy: [{ tripDate: "asc" }, { market: "asc" }],
  });
}

function summarizeSubMarketRows(rows: UnloadingFeeRow[], deps: Deps) {
  const sub = rows.filter((r) =>
    KL_SUB_MARKETS.includes(r.market as (typeof KL_SUB_MARKETS)[number])
  );
  const qty = (r: UnloadingFeeRow) =>
    r.smallCrateQty + r.largeCrateQty + r.boxQty;
  const bugRows = sub.filter((r) => r.unloadFee === 0 && qty(r) > 0);
  return {
    subMarketRowCount: sub.length,
    bugRowCount: bugRows.length,
    bugUnloadFeeTotal: round2(bugRows.reduce((s, r) => s + r.unloadFee, 0)),
    subUnloadFeeTotal: round2(sub.reduce((s, r) => s + r.unloadFee, 0)),
    subKpbTotal: round2(
      sub.reduce(
        (s, r) =>
          s +
          deps.effectiveKpbFee({
            kpbFee: r.kpbFee,
            kpbFeeOverride: r.kpbFeeOverride,
            isKpbExempt: r.isKpbExempt,
          }),
        0
      )
    ),
    subGrandTotal: round2(sub.reduce((s, r) => s + rowSubtotal(r, deps), 0)),
    bugRowsSample: bugRows.slice(0, 5).map((r) => ({
      tripId: r.tripId,
      market: r.market,
      storeCode: r.storeCode,
      qty: qty(r),
      unloadFee: r.unloadFee,
      kpbFee: r.kpbFee,
      isKpbExempt: r.isKpbExempt,
    })),
  };
}

async function pnlJuneUnloadTotal(deps: Deps) {
  const { start, end } = deps.getMonthDateRange(2026, 6);
  const dispatches = await deps.prisma.dispatchOrder.findMany({
    where: {
      status: { notIn: ["draft", "cancelled"] },
      date: { gte: start, lte: end },
    },
    select: { id: true },
  });

  let totalUnload = 0;
  for (const d of dispatches) {
    const trip = await deps.buildPnlTripDetail({
      tripId: d.id,
      year: 2026,
      month: 6,
    });
    totalUnload += trip.shippers.reduce((s, sh) => s + sh.unloadFeeMyr, 0);
  }
  return round2(totalUnload);
}

async function runAudit(deps: Deps) {
  const trips = await findAffectedTripIds(deps);
  const tripIds = trips.map((t) => t.id);
  const fees = await fetchUnloadingFeesForTrips(deps, tripIds);
  const summary = summarizeSubMarketRows(fees, deps);

  console.log(
    JSON.stringify(
      {
        affectedTripCount: trips.length,
        unloadingFeeRowCount: fees.length,
        ...summary,
        tripsSample: trips.slice(0, 8).map((t) => ({
          id: t.id,
          date: t.date.toISOString().slice(0, 10),
          plate: t.truck.plate,
        })),
      },
      null,
      2
    )
  );
  return { trips, tripIds, fees, summary };
}

async function runBackup(deps: Deps, tripIds: string[]) {
  const fees = await fetchUnloadingFeesForTrips(deps, tripIds);
  const periodSummary = await deps.buildPnlPeriodSummary({
    year: 2026,
    month: 6,
  });
  const juneUnload = await pnlJuneUnloadTotal(deps);

  const payload = {
    createdAt: new Date().toISOString(),
    reason: "SL/BP/MP base unload fee was 0 (!rate before KL sub-market fix)",
    tripIds,
    unloadingFees: fees,
    pnlJune2026: {
      periodCostMyr: periodSummary.periodSummary.costMyr,
      unloadAllocatedMyr: juneUnload,
    },
  };

  writeFileSync(BACKUP_PATH, JSON.stringify(payload, null, 2));
  writeFileSync(PNL_SNAPSHOT_PATH, JSON.stringify(payload.pnlJune2026, null, 2));
  console.log(
    `Backup written: ${BACKUP_PATH} (${fees.length} rows, ${tripIds.length} trips)`
  );
  return payload;
}

async function runRecalc(deps: Deps, tripIds: string[]) {
  let ok = 0;
  const errors: { tripId: string; error: string }[] = [];
  for (const tripId of tripIds) {
    try {
      await deps.generateUnloadingFeesForTrip(tripId);
      ok++;
    } catch (e) {
      errors.push({
        tripId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  console.log(`Regenerated ${ok}/${tripIds.length} trips`);
  if (errors.length) console.log("Errors:", errors);
  return { ok, errors };
}

async function runVerify(deps: Deps, tripIds: string[]) {
  const fees = await fetchUnloadingFeesForTrips(deps, tripIds);
  const summary = summarizeSubMarketRows(fees, deps);

  const withQty = fees.filter(
    (r) =>
      KL_SUB_MARKETS.includes(r.market as (typeof KL_SUB_MARKETS)[number]) &&
      r.smallCrateQty + r.largeCrateQty + r.boxQty > 0
  );
  const baseFeePositive = withQty.filter((r) => r.unloadFee > 0);
  const kpbNoStall = withQty.filter(
    (r) => !r.storeCode?.trim() && r.kpbFee === 0
  );
  const kpbWithStall = withQty.filter(
    (r) => r.storeCode?.trim() && !r.isKpbExempt && r.kpbFee > 0
  );

  const backup = existsSync(BACKUP_PATH)
    ? (JSON.parse(readFileSync(BACKUP_PATH, "utf8")) as {
        unloadingFees: UnloadingFeeRow[];
        pnlJune2026: { unloadAllocatedMyr: number };
      })
    : null;

  const before = backup
    ? summarizeSubMarketRows(backup.unloadingFees, deps)
    : null;
  const afterUnload = summary.subUnloadFeeTotal;
  const afterGrand = summary.subGrandTotal;
  const juneUnloadAfter = await pnlJuneUnloadTotal(deps);

  console.log(
    JSON.stringify(
      {
        subMarketRowsWithQty: withQty.length,
        baseFeePositiveCount: baseFeePositive.length,
        kpbNoStallExemptCount: kpbNoStall.length,
        kpbWithStallChargedCount: kpbWithStall.length,
        beforeSubMarket: before,
        afterSubMarket: summary,
        subMarketUnloadDelta: before
          ? round2(afterUnload - before.subUnloadFeeTotal)
          : null,
        subMarketGrandDelta: before
          ? round2(afterGrand - before.subGrandTotal)
          : null,
        pnlJuneUnloadBefore: backup?.pnlJune2026.unloadAllocatedMyr ?? null,
        pnlJuneUnloadAfter: juneUnloadAfter,
        pnlJuneUnloadDelta: backup
          ? round2(juneUnloadAfter - backup.pnlJune2026.unloadAllocatedMyr)
          : null,
        samplesAfter: withQty.slice(0, 6).map((r) => ({
          tripId: r.tripId,
          market: r.market,
          storeCode: r.storeCode,
          qty: r.smallCrateQty + r.largeCrateQty + r.boxQty,
          unloadFee: r.unloadFee,
          kpbFee: r.kpbFee,
          isKpbExempt: r.isKpbExempt,
          total: rowSubtotal(r, deps),
        })),
      },
      null,
      2
    )
  );
}

async function main() {
  const { prisma } = await import("../lib/prisma");
  const { getMonthDateRange } = await import("../lib/reports/period-report-shared");
  const { buildPnlPeriodSummary, buildPnlTripDetail } = await import(
    "../lib/pnl-report"
  );
  const { generateUnloadingFeesForTrip } = await import(
    "../lib/driver-expense-service"
  );
  const { effectiveKpbFee, effectiveUnloadFee } = await import(
    "../lib/unloading-calculator"
  );

  const deps: Deps = {
    prisma,
    getMonthDateRange,
    buildPnlPeriodSummary,
    buildPnlTripDetail,
    generateUnloadingFeesForTrip,
    effectiveKpbFee,
    effectiveUnloadFee,
  };

  const step = stepArg();
  const { tripIds } = await runAudit(deps);

  if (step === "audit") return;

  if (step === "backup" || step === "all") {
    if (!existsSync(BACKUP_PATH)) {
      await runBackup(deps, tripIds);
    } else {
      console.log(`Backup already exists: ${BACKUP_PATH} (skip)`);
    }
  }

  if (step === "recalc" || step === "all") {
    await runRecalc(deps, tripIds);
  }

  if (step === "verify" || step === "all") {
    await runVerify(deps, tripIds);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
