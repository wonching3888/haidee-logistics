/**
 * Phase 2 self-test: rate settings, monthly lock, Songkhla P&L, drivers.
 * Run: npx tsx --env-file=.env.local scripts/_selftest-thai-cost-phase2-songkhla.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { calendarDateUTC } from "../lib/reports/period-report-shared";
import {
  ensureThaiCostRateSettings,
  loadCurrentThaiCostRates,
  resolveThaiCostRatesForMonth,
  saveCurrentThaiCostRates,
} from "../lib/thai-cost/rate-settings";
import { lockThaiMonthSnapshots } from "../lib/thai-cost/segment-internal-cost";
import { getSongkhlaPnl } from "../lib/thai-cost/songkhla-pnl";
import { getSadaoMonthlyCost } from "../lib/thai-cost/sadao-cost-service";

const MARKER = "SELFTEST_PHASE2";
const YEAR = 2026;
const MONTH = 7; // use July to avoid clobbering June production backfill

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

function pass(name: string, detail: string) {
  checks.push({ name, ok: true, detail });
  console.log(`  PASS  ${name}: ${detail}`);
}
function fail(name: string, detail: string) {
  checks.push({ name, ok: false, detail });
  console.error(`  FAIL  ${name}: ${detail}`);
}

async function cleanup() {
  const { start, end } = {
    start: calendarDateUTC(YEAR, MONTH, 1),
    end: calendarDateUTC(YEAR, MONTH, 31),
  };
  await prisma.songkhlaCrateHandlingDaily.deleteMany({
    where: { notes: { contains: MARKER } },
  });
  await prisma.thaiDailyLaborAttendance.deleteMany({
    where: { notes: { contains: MARKER } },
  });
  await prisma.thaiDriverTripDaily.deleteMany({
    where: { notes: { contains: MARKER } },
  });
  await prisma.thaiMonthlyWorker.deleteMany({
    where: { name: { startsWith: `${MARKER}_` } },
  });
  await prisma.thaiCostMonthlyRateSnapshot.deleteMany({
    where: { yearMonth: "2026-07" },
  });
  await prisma.thaiSegmentInternalCostSnapshot.deleteMany({
    where: { yearMonth: "2026-07" },
  });
  await prisma.thaiDailyLaborMonthlyRoster.deleteMany({
    where: {
      yearMonth: "2026-07",
      station: "SONGKHLA",
      notes: { contains: MARKER },
    },
  });
  void start;
  void end;
}

async function main() {
  console.log("=== Thai cost Phase 2 self-test (Songkhla) ===\n");

  const actor =
    (await prisma.user.findFirst({
      where: { active: true, role: "admin" },
      select: { id: true },
    })) ??
    (await prisma.user.findFirst({ where: { active: true }, select: { id: true } }));
  if (!actor) throw new Error("No user");

  await cleanup();
  await ensureThaiCostRateSettings();

  const defaults = await loadCurrentThaiCostRates();
  if (defaults.handlingSmallWeekday === 3 && defaults.driverTripSongkhla === 700) {
    pass("default rates seeded", JSON.stringify(defaults));
  } else {
    fail("default rates seeded", JSON.stringify(defaults));
  }

  // Seed drivers
  const driverSeeds = [
    { name: "THONGDANG", baseWage: 8000 },
    { name: "P.NARONG", baseWage: 8000 },
    { name: "P.PHONG", baseWage: 7000 },
    { name: "P.CHAIRAT", baseWage: 6000 },
  ];
  for (const s of driverSeeds) {
    await prisma.thaiDriver.upsert({
      where: { name: s.name },
      create: s,
      update: { baseWage: s.baseWage, active: true },
    });
  }
  const drivers = await prisma.thaiDriver.findMany({
    where: { name: { in: driverSeeds.map((d) => d.name) } },
  });
  if (drivers.length === 4) pass("drivers seeded", "4 drivers");
  else fail("drivers seeded", `count=${drivers.length}`);

  // Songkhla monthly worker placeholder (no PDF detail)
  await prisma.thaiMonthlyWorker.create({
    data: {
      name: `${MARKER}_SONGKHLA_CLERK`,
      station: "SONGKHLA",
      monthlyWage: 8000,
      lunchAllowance: 1000,
      fuelAllowance: 0,
      rentRoomAllowance: 0,
      active: true,
    },
  });
  pass("songkhla worker placeholder", "PENDING_PDF — 8000+1000 lunch");

  await prisma.thaiDailyLaborMonthlyRoster.upsert({
    where: {
      yearMonth_station: { yearMonth: "2026-07", station: "SONGKHLA" },
    },
    create: {
      yearMonth: "2026-07",
      station: "SONGKHLA",
      rosterCount: 5,
      notes: MARKER,
    },
    update: { rosterCount: 5, notes: MARKER },
  });

  await prisma.thaiDailyLaborAttendance.create({
    data: {
      date: calendarDateUTC(YEAR, MONTH, 1),
      station: "SONGKHLA",
      attendanceCount: 5,
      dailyWage: 300,
      notes: MARKER,
      createdBy: actor.id,
    },
  });

  await prisma.songkhlaCrateHandlingDaily.create({
    data: {
      date: calendarDateUTC(YEAR, MONTH, 1),
      smallCrateTotalQty: 100,
      largeCrateTotalQty: 20,
      boxTotalQty: 10,
      notes: MARKER,
      createdBy: actor.id,
    },
  });

  const thongdang = drivers.find((d) => d.name === "THONGDANG")!;
  await prisma.thaiDriverTripDaily.create({
    data: {
      date: calendarDateUTC(YEAR, MONTH, 1),
      driverId: thongdang.id,
      songkhlaTripCount: 2,
      pattaniTripCount: 1,
      notes: MARKER,
      createdBy: actor.id,
    },
  });

  // Lock month snapshots
  const lock = await lockThaiMonthSnapshots({
    year: YEAR,
    month: MONTH,
    createdBy: actor.id,
    force: true,
    pickups: ["SONGKHLA", "PATTANI"],
  });
  pass(
    "month lock",
    `rates locked, segments=${lock.segmentSnapshots.map((s) => `${s.pickupLocation}:${s.totalAmountMyr}`).join(",")}`
  );

  const ratesBefore = await resolveThaiCostRatesForMonth(YEAR, MONTH);
  if (ratesBefore.locked && ratesBefore.handlingSmallWeekday === 3) {
    pass("rates locked at 3", "snapshot");
  } else {
    fail("rates locked at 3", JSON.stringify(ratesBefore));
  }

  // Change current settings — locked month must not drift
  await saveCurrentThaiCostRates(
    {
      ...ratesBefore,
      handlingSmallWeekday: 99,
      driverTripSongkhla: 999,
    },
    actor.id
  );
  const ratesAfterChange = await resolveThaiCostRatesForMonth(YEAR, MONTH);
  if (ratesAfterChange.handlingSmallWeekday === 3) {
    pass("locked month ignores setting change", "still 3");
  } else {
    fail(
      "locked month ignores setting change",
      `got ${ratesAfterChange.handlingSmallWeekday}`
    );
  }

  const current = await loadCurrentThaiCostRates();
  if (current.handlingSmallWeekday === 99) {
    pass("current settings updated", "99");
  } else {
    fail("current settings updated", String(current.handlingSmallWeekday));
  }

  // Restore defaults for other months
  await saveCurrentThaiCostRates(
    {
      handlingSmallWeekday: 3,
      handlingSmallHoliday: 5,
      handlingLargeWeekday: 4,
      handlingLargeHoliday: 6,
      driverTripSongkhla: 700,
      driverTripPattani: 1200,
      pattaniContractorCrate: 20,
      pattaniContractorBox: 5,
      pattaniSakriCrate: 2.2,
      largeTongTypeCodes: ["VIO", "BS", "GKS"],
    },
    actor.id
  );

  const pnl = await getSongkhlaPnl(YEAR, MONTH);
  // Marker worker 9000 + production SAMRAN 20000 + PRATHUENG 15000
  // daily 5*300=1500, Songkhla daily LUNCH=0 (no roster lunch)
  // Handling weekday: 100*3+20*4+10*3 = 300+80+30 = 410
  // Driver: base 8000 * (2/3) = 5333.33, trips 2*700 = 1400
  const expectedLabor = 9000 + 20000 + 15000 + 1500 + 0 + 410;
  const expectedDriverBase = Math.round((8000 * 2) / 3 * 100) / 100;
  const expectedDriverTrip = 1400;
  const expectedReal =
    expectedLabor + expectedDriverBase + expectedDriverTrip;

  if (Math.abs(pnl.realCostThb - expectedReal) < 0.02) {
    pass("songkhla real cost", `${pnl.realCostThb} ≈ ${expectedReal}`);
  } else {
    fail("songkhla real cost", `got ${pnl.realCostThb} expected ${expectedReal}`);
  }

  if (pnl.internalCostLocked) {
    pass("internal cost locked", `MYR=${pnl.internalCostMyr}`);
  } else {
    fail("internal cost locked", "missing snapshot");
  }

  if (pnl.pnlMyr != null) {
    pass("pnl computed", `pnlMyr=${pnl.pnlMyr}`);
  } else {
    fail("pnl computed", "null");
  }

  // Sadao June still uses rates (may be unlocked) — smoke
  const sadao = await getSadaoMonthlyCost(2026, 6);
  if (sadao.rates) {
    pass("sadao rates attached", `source=${sadao.rates.source}`);
  } else {
    fail("sadao rates attached", "missing");
  }

  await cleanup();
  // restore defaults already done
  console.log("\nCleanup done (July self-test rows).");

  const failed = checks.filter((c) => !c.ok);
  console.log(
    `\n=== Result: ${checks.length - failed.length}/${checks.length} passed ===`
  );
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
