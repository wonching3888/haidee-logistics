/**
 * Generate unloading_fee for 12 June 2026 dispatches that had zero rows.
 * Same flow as backfill-sl-bp-mp-unloading-fees.ts (backup → recalc → verify).
 *
 * Usage: node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/backfill-remaining-12-june-unloading-fees.ts [--step=audit|backup|recalc|verify|all]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";

const TARGET_DISPATCH_NOS = [
  "DO-20260601-003",
  "DO-20260601-004",
  "DO-20260610-003",
  "DO-20260610-005",
  "DO-20260611-005",
  "DO-20260615-004",
  "DO-20260615-005",
  "DO-20260615-006",
  "DO-20260616-003",
  "DO-20260616-004",
  "DO-20260616-005",
  "DO-20260617-003",
] as const;

const BACKUP_PATH = join(
  process.cwd(),
  "scripts",
  "backup-remaining-12-trips-before-fix-2026-06-17.json"
);

// 19-trip backfill scope (fee totals after that run must not change)
const PRIOR_BACKFILL_PATH = join(
  process.cwd(),
  "scripts",
  "backup-sl-bp-mp-unloading-fees-2026-06-17.json"
);

type FeeSnapshot = {
  tripId: string;
  rowCount: number;
  totalMyr: number;
};

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

function rowTotal(
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

function tripFeeTotal(rows: UnloadingFeeRow[], deps: Deps) {
  return round2(rows.reduce((s, r) => s + rowTotal(r, deps), 0));
}

async function resolveTargetTrips(deps: Deps) {
  const trips = await deps.prisma.dispatchOrder.findMany({
    where: { dispatchNo: { in: [...TARGET_DISPATCH_NOS] } },
    select: {
      id: true,
      dispatchNo: true,
      date: true,
      driverName: true,
      markets: true,
      createdAt: true,
      truck: { select: { plate: true } },
    },
    orderBy: [{ date: "asc" }, { dispatchNo: "asc" }],
  });

  const found = new Set(trips.map((t) => t.dispatchNo));
  const missing = TARGET_DISPATCH_NOS.filter((n) => !found.has(n));
  if (missing.length) {
    throw new Error(`Dispatch not found: ${missing.join(", ")}`);
  }

  return trips;
}

async function fetchFees(deps: Deps, tripIds: string[]) {
  if (tripIds.length === 0) return [];
  return deps.prisma.unloadingFee.findMany({
    where: { tripId: { in: tripIds } },
    orderBy: [{ tripDate: "asc" }, { market: "asc" }],
  });
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

async function pnlJuneGrossProfitTotal(deps: Deps) {
  const { start, end } = deps.getMonthDateRange(2026, 6);
  const dispatches = await deps.prisma.dispatchOrder.findMany({
    where: {
      status: { notIn: ["draft", "cancelled"] },
      date: { gte: start, lte: end },
    },
    select: { id: true },
  });

  let total = 0;
  for (const d of dispatches) {
    const trip = await deps.buildPnlTripDetail({
      tripId: d.id,
      year: 2026,
      month: 6,
    });
    total += trip.grossProfitMyr;
  }
  return round2(total);
}

async function feeSnapshotsForTrips(
  deps: Deps,
  tripIds: string[]
): Promise<FeeSnapshot[]> {
  const fees = await fetchFees(deps, tripIds);
  const byTrip = new Map<string, UnloadingFeeRow[]>();
  for (const r of fees) {
    const g = byTrip.get(r.tripId) ?? [];
    g.push(r);
    byTrip.set(r.tripId, g);
  }
  return tripIds.map((tripId) => {
    const rows = byTrip.get(tripId) ?? [];
    return {
      tripId,
      rowCount: rows.length,
      totalMyr: tripFeeTotal(rows, deps),
    };
  });
}

async function otherJuneTripIds(deps: Deps, excludeIds: string[]) {
  const { start, end } = deps.getMonthDateRange(2026, 6);
  const dispatches = await deps.prisma.dispatchOrder.findMany({
    where: {
      status: { notIn: ["draft", "cancelled"] },
      date: { gte: start, lte: end },
      id: { notIn: excludeIds },
    },
    select: { id: true },
  });
  return dispatches.map((d) => d.id);
}

async function tripPnlUnload(deps: Deps, tripId: string) {
  const trip = await deps.buildPnlTripDetail({
    tripId,
    year: 2026,
    month: 6,
  });
  return {
    unloadAllocatedMyr: round2(
      trip.shippers.reduce((s, sh) => s + sh.unloadFeeMyr, 0)
    ),
    grossProfitMyr: trip.grossProfitMyr,
  };
}

async function runAudit(deps: Deps) {
  const trips = await resolveTargetTrips(deps);
  const tripIds = trips.map((t) => t.id);
  const fees = await fetchFees(deps, tripIds);

  const byTrip = new Map<string, number>();
  for (const t of trips) {
    byTrip.set(
      t.id,
      fees.filter((f) => f.tripId === t.id).length
    );
  }

  console.log(
    JSON.stringify(
      {
        targetCount: trips.length,
        totalUnloadingFeeRows: fees.length,
        trips: trips.map((t) => ({
          dispatchNo: t.dispatchNo,
          tripId: t.id,
          date: t.date.toISOString().slice(0, 10),
          plate: t.truck.plate,
          driver: t.driverName,
          route: t.markets.join("/"),
          dispatchCreatedAt: t.createdAt.toISOString(),
          unloadingFeeRowsBefore: byTrip.get(t.id) ?? 0,
        })),
      },
      null,
      2
    )
  );
  return { trips, tripIds, fees };
}

async function runBackup(deps: Deps, trips: Awaited<ReturnType<typeof resolveTargetTrips>>) {
  const tripIds = trips.map((t) => t.id);
  const fees = await fetchFees(deps, tripIds);

  let prior19TripIds: string[] = [];
  if (existsSync(PRIOR_BACKFILL_PATH)) {
    const prior = JSON.parse(readFileSync(PRIOR_BACKFILL_PATH, "utf8")) as {
      tripIds: string[];
    };
    prior19TripIds = prior.tripIds;
  }
  const otherJuneIds = await otherJuneTripIds(deps, tripIds);
  const scopeSnapshot = {
    prior19: await feeSnapshotsForTrips(deps, prior19TripIds),
    otherJune: await feeSnapshotsForTrips(deps, otherJuneIds),
  };

  const payload = {
    createdAt: new Date().toISOString(),
    reason:
      "12 June dispatches with zero unloading_fee rows before first-time generation",
    dispatchNos: [...TARGET_DISPATCH_NOS],
    tripIds,
    trips: trips.map((t) => ({
      dispatchNo: t.dispatchNo,
      tripId: t.id,
      date: t.date.toISOString().slice(0, 10),
      plate: t.truck.plate,
      route: t.markets.join("/"),
      unloadingFeeRowCount: fees.filter((f) => f.tripId === t.id).length,
    })),
    unloadingFees: fees,
    scopeSnapshot,
    pnlJune2026: {
      unloadAllocatedMyr: await pnlJuneUnloadTotal(deps),
      grossProfitMyr: await pnlJuneGrossProfitTotal(deps),
      periodCostMyr: (
        await deps.buildPnlPeriodSummary({ year: 2026, month: 6 })
      ).periodSummary.costMyr,
    },
  };

  writeFileSync(BACKUP_PATH, JSON.stringify(payload, null, 2));
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
  if (errors.length) throw new Error("Recalc had failures");
  return { ok, errors };
}

async function verifyScopeUnchanged(
  deps: Deps,
  backup: { scopeSnapshot?: { prior19: FeeSnapshot[]; otherJune: FeeSnapshot[] } }
) {
  if (!backup.scopeSnapshot) {
    return { skipped: true, reason: "no scope snapshot in backup" };
  }

  const prior19Now = await feeSnapshotsForTrips(
    deps,
    backup.scopeSnapshot.prior19.map((s) => s.tripId)
  );
  const otherJuneNow = await feeSnapshotsForTrips(
    deps,
    backup.scopeSnapshot.otherJune.map((s) => s.tripId)
  );

  function diff(before: FeeSnapshot[], after: FeeSnapshot[]) {
    const afterMap = new Map(after.map((s) => [s.tripId, s]));
    return before.filter((b) => {
      const a = afterMap.get(b.tripId);
      return !a || a.rowCount !== b.rowCount || a.totalMyr !== b.totalMyr;
    });
  }

  const prior19Changed = diff(backup.scopeSnapshot.prior19, prior19Now);
  const otherChanged = diff(backup.scopeSnapshot.otherJune, otherJuneNow);

  return {
    prior19TripCount: backup.scopeSnapshot.prior19.length,
    otherJuneTripCount: backup.scopeSnapshot.otherJune.length,
    unchanged: prior19Changed.length === 0 && otherChanged.length === 0,
    prior19Changed,
    otherJuneChanged: otherChanged,
  };
}

async function runVerify(
  deps: Deps,
  trips: Awaited<ReturnType<typeof resolveTargetTrips>>,
  backup: Awaited<ReturnType<typeof runBackup>>
) {
  const tripIds = trips.map((t) => t.id);
  const fees = await fetchFees(deps, tripIds);
  const juneUnloadAfter = await pnlJuneUnloadTotal(deps);
  const juneGrossProfitAfter = await pnlJuneGrossProfitTotal(deps);

  const tripReports = [];
  for (const t of trips) {
    const rows = fees.filter((f) => f.tripId === t.id);
    const pnl = await tripPnlUnload(deps, t.id);
    const feeTotal = tripFeeTotal(rows, deps);
    tripReports.push({
      dispatchNo: t.dispatchNo,
      tripId: t.id,
      date: t.date.toISOString().slice(0, 10),
      plate: t.truck.plate,
      driver: t.driverName,
      route: t.markets.join("/"),
      unloadingFeeRows: rows.length,
      feeTableTotalMyr: feeTotal,
      pnlUnloadAllocatedMyr: pnl.unloadAllocatedMyr,
      pnlGrossProfitMyr: pnl.grossProfitMyr,
      markets: rows.map((r) => ({
        market: r.market,
        storeCode: r.storeCode,
        qty: r.smallCrateQty + r.largeCrateQty + r.boxQty,
        unloadFee: r.unloadFee,
        kpbFee: r.kpbFee,
        isKpbExempt: r.isKpbExempt,
        total: rowTotal(r, deps),
      })),
    });
  }

  const scopeCheck = await verifyScopeUnchanged(deps, backup);

  const zeroRowTrips = tripReports.filter((t) => t.unloadingFeeRows === 0);

  console.log(
    JSON.stringify(
      {
        allTripsHaveFees: zeroRowTrips.length === 0,
        zeroRowTrips,
        tripReports,
        pnlJune2026: {
          unloadBeforeMyr: backup.pnlJune2026.unloadAllocatedMyr,
          unloadAfterMyr: juneUnloadAfter,
          unloadDeltaMyr: round2(
            juneUnloadAfter - backup.pnlJune2026.unloadAllocatedMyr
          ),
          grossProfitBeforeMyr: backup.pnlJune2026.grossProfitMyr,
          grossProfitAfterMyr: juneGrossProfitAfter,
          grossProfitDeltaMyr: round2(
            juneGrossProfitAfter - backup.pnlJune2026.grossProfitMyr
          ),
        },
        scopeUnchangedCheck: scopeCheck,
        backfill0601: tripReports.filter((t) =>
          t.dispatchNo.startsWith("DO-20260601")
        ),
      },
      null,
      2
    )
  );

  if (zeroRowTrips.length > 0) {
    throw new Error("Some trips still have zero unloading_fee rows");
  }
  if (!scopeCheck.unchanged && !scopeCheck.skipped) {
    throw new Error("Trips outside the 12-target scope were modified");
  }
}

async function main() {
  const { prisma } = await import("../lib/prisma");
  const { getMonthDateRange } = await import(
    "../lib/reports/period-report-shared"
  );
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
  const { trips, tripIds } = await runAudit(deps);

  let backup: Awaited<ReturnType<typeof runBackup>> | null = null;

  if (step === "backup" || step === "all") {
    backup = await runBackup(deps, trips);
  } else if (existsSync(BACKUP_PATH)) {
    backup = JSON.parse(readFileSync(BACKUP_PATH, "utf8"));
  }

  if (step === "recalc" || step === "all") {
    await runRecalc(deps, tripIds);
  }

  if (step === "verify" || step === "all") {
    if (!backup) {
      backup = existsSync(BACKUP_PATH)
        ? JSON.parse(readFileSync(BACKUP_PATH, "utf8"))
        : await runBackup(deps, trips);
    }
    await runVerify(deps, trips, backup);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
