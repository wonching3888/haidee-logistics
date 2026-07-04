/**
 * Pattani cost + Songkhla weekday-only rates self-test.
 * Run: npx tsx --env-file=.env.local scripts/_selftest-thai-cost-pattani.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "../lib/prisma";
import { calendarDateUTC } from "../lib/reports/period-report-shared";
import {
  computePattaniDayCosts,
  ensureThaiCostRateSettings,
  loadCurrentThaiCostRates,
  resolveThaiCostRatesForMonth,
  saveCurrentThaiCostRates,
} from "../lib/thai-cost/rate-settings";
import { lockThaiMonthSnapshots } from "../lib/thai-cost/segment-internal-cost";
import { getPattaniPnl } from "../lib/thai-cost/pattani-pnl";
import { getSongkhlaMonthlyRealCost } from "../lib/thai-cost/songkhla-cost-service";
import { computeSadaoHandlingCommission } from "../lib/thai-cost/sadao-cost";

const MARKER = "SELFTEST_PATTANI";
const YEAR = 2026;
const MONTH = 8;

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
  await prisma.pattaniCrateHandlingDaily.deleteMany({
    where: { notes: { contains: MARKER } },
  });
  await prisma.songkhlaCrateHandlingDaily.deleteMany({
    where: { notes: { contains: MARKER } },
  });
  await prisma.thaiDriverTripDaily.deleteMany({
    where: { notes: { contains: MARKER } },
  });
  await prisma.thaiCostMonthlyRateSnapshot.deleteMany({
    where: { yearMonth: "2026-08" },
  });
  await prisma.thaiSegmentInternalCostSnapshot.deleteMany({
    where: { yearMonth: "2026-08" },
  });
}

async function main() {
  console.log("=== Pattani + Songkhla weekday-only self-test ===\n");

  const actor =
    (await prisma.user.findFirst({
      where: { active: true, role: "admin" },
      select: { id: true },
    })) ??
    (await prisma.user.findFirst({
      where: { active: true },
      select: { id: true },
    }));
  if (!actor) throw new Error("No user");

  await cleanup();
  await ensureThaiCostRateSettings();

  // Pure: same batch → contractor + SAKRI; box only contractor
  const rates = await loadCurrentThaiCostRates();
  const day = computePattaniDayCosts(100, 10, rates);
  // contractor = 100*20 + 10*5 = 2050; sakri = 100*2.2 = 220
  if (day.contractorThb === 2050 && day.sakriCommissionThb === 220) {
    pass("pattani day split", `contractor=${day.contractorThb} sakri=${day.sakriCommissionThb}`);
  } else {
    fail("pattani day split", JSON.stringify(day));
  }
  const boxOnly = computePattaniDayCosts(0, 10, rates);
  if (boxOnly.contractorThb === 50 && boxOnly.sakriCommissionThb === 0) {
    pass("box no sakri commission", "50 contractor, 0 sakri");
  } else {
    fail("box no sakri commission", JSON.stringify(boxOnly));
  }

  // Songkhla always weekday even on Sunday date
  const sunday = calendarDateUTC(YEAR, MONTH, 2); // 2026-08-02 is Sunday
  await prisma.songkhlaCrateHandlingDaily.create({
    data: {
      date: sunday,
      smallCrateTotalQty: 10,
      largeCrateTotalQty: 5,
      boxTotalQty: 2,
      notes: MARKER,
      createdBy: actor.id,
    },
  });
  const skCost = await getSongkhlaMonthlyRealCost(YEAR, MONTH);
  // weekday: 10*3+5*4+2*3 = 30+20+6 = 56 (NOT holiday 10*5+5*6+2*5=50+30+10=90)
  if (skCost.handlingCommissionTotalThb === 56) {
    pass("songkhla sunday uses weekday rates", "56 not 90");
  } else {
    fail(
      "songkhla sunday uses weekday rates",
      `got ${skCost.handlingCommissionTotalThb}`
    );
  }

  // Seed SAKRI
  const sakri = await prisma.thaiMonthlyWorker.findFirst({
    where: { name: "SAKRI", station: "PATTANI" },
  });
  if (sakri) {
    await prisma.thaiMonthlyWorker.update({
      where: { id: sakri.id },
      data: {
        monthlyWage: 15000,
        lunchAllowance: 0,
        fuelAllowance: 0,
        rentRoomAllowance: 0,
        active: true,
      },
    });
  } else {
    await prisma.thaiMonthlyWorker.create({
      data: {
        name: "SAKRI",
        station: "PATTANI",
        monthlyWage: 15000,
        lunchAllowance: 0,
        fuelAllowance: 0,
        rentRoomAllowance: 0,
        active: true,
      },
    });
  }
  pass("SAKRI worker", "15000 wage, allowances 0");

  await prisma.pattaniCrateHandlingDaily.create({
    data: {
      date: calendarDateUTC(YEAR, MONTH, 3),
      crateQty: 100,
      boxQty: 10,
      notes: MARKER,
      createdBy: actor.id,
    },
  });

  const drivers = await prisma.thaiDriver.findMany({
    where: { name: { in: ["THONGDANG", "P.NARONG", "P.PHONG", "P.CHAIRAT"] } },
  });
  if (drivers.length < 1) {
    await prisma.thaiDriver.create({
      data: { name: "THONGDANG", baseWage: 8000, active: true },
    });
  }
  const thongdang = await prisma.thaiDriver.findUnique({
    where: { name: "THONGDANG" },
  });
  await prisma.thaiDriverTripDaily.create({
    data: {
      date: calendarDateUTC(YEAR, MONTH, 3),
      driverId: thongdang!.id,
      songkhlaTripCount: 1,
      pattaniTripCount: 2,
      notes: MARKER,
      createdBy: actor.id,
    },
  });

  const lock = await lockThaiMonthSnapshots({
    year: YEAR,
    month: MONTH,
    createdBy: actor.id,
    force: true,
  });
  pass(
    "pattani snapshot lock",
    lock.segmentSnapshots
      .map((s) => `${s.pickupLocation}=${s.totalAmountMyr}`)
      .join(", ")
  );

  // Change pattani rates — locked month must keep 20/5/2.2
  const lockedRates = await resolveThaiCostRatesForMonth(YEAR, MONTH);
  await saveCurrentThaiCostRates(
    {
      ...lockedRates,
      pattaniContractorCrate: 99,
      pattaniSakriCrate: 9,
    },
    actor.id
  );
  const stillLocked = await resolveThaiCostRatesForMonth(YEAR, MONTH);
  if (
    stillLocked.pattaniContractorCrate === 20 &&
    stillLocked.pattaniSakriCrate === 2.2
  ) {
    pass("pattani rates locked against drift", "20 / 2.2");
  } else {
    fail("pattani rates locked against drift", JSON.stringify(stillLocked));
  }

  // Restore defaults
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
    },
    actor.id
  );

  const pnl = await getPattaniPnl(YEAR, MONTH);
  // SAKRI 15000 + commission 220 + contractor 2050
  // Driver: base 8000 * (2/3) = 5333.33, trips 2*1200 = 2400
  const expected =
    15000 + 220 + 2050 + Math.round((8000 * 2) / 3 * 100) / 100 + 2400;
  if (Math.abs(pnl.real.sakriCommissionThb - 220) < 0.01) {
    pass("sakri commission total", String(pnl.real.sakriCommissionThb));
  } else {
    fail("sakri commission total", String(pnl.real.sakriCommissionThb));
  }
  if (Math.abs(pnl.real.contractorThb - 2050) < 0.01) {
    pass("contractor total", String(pnl.real.contractorThb));
  } else {
    fail("contractor total", String(pnl.real.contractorThb));
  }
  if (Math.abs(pnl.realCostThb - expected) < 0.02) {
    pass("pattani real cost total", `${pnl.realCostThb} ≈ ${expected}`);
  } else {
    fail("pattani real cost total", `got ${pnl.realCostThb} expected ${expected}`);
  }
  if (pnl.internalCostLocked && pnl.pnlMyr != null) {
    pass("pattani pnl", `internal=${pnl.internalCostMyr} pnl=${pnl.pnlMyr}`);
  } else {
    fail("pattani pnl", "missing lock or pnl");
  }

  // Explicit: holidayRate true would differ for songkhla if wrongly applied
  const holidayWouldBe = computeSadaoHandlingCommission(
    {
      smallCrateTotalQty: 10,
      largeCrateTotalQty: 5,
      boxTotalQty: 2,
      smallCrateNoCheckQty: 0,
      largeCrateNoCheckQty: 0,
      boxNoCheckQty: 0,
    },
    { holidayRate: true, rateConfig: rates }
  ).totalCommissionThb;
  if (holidayWouldBe === 90 && skCost.handlingCommissionTotalThb === 56) {
    pass("songkhla not using holiday branch", "56 vs holiday 90");
  } else {
    fail(
      "songkhla not using holiday branch",
      `sk=${skCost.handlingCommissionTotalThb} holidayWould=${holidayWouldBe}`
    );
  }

  await cleanup();
  console.log("\nCleanup done.");

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
