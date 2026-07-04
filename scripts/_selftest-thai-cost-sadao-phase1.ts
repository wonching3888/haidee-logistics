/**
 * Phase 2 stage 1 self-test: Sadao Thai cost with allowances + BOX.
 *
 * Run: npx tsx --env-file=.env.local scripts/_selftest-thai-cost-sadao-phase1.ts
 *
 * Uses SELFTEST_ marker rows for attendance/handling so cleanup is safe.
 * Monthly workers / roster use real June 2026 seed (not cleaned).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "crypto";
import {
  DEFAULT_LUNCH_ALLOWANCE_THB,
  DEFAULT_SADAO_DAILY_WAGE_THB,
  SADAO_JUNE_2026_DAILY_LABOR_ROSTER_COUNT,
  SADAO_JUNE_2026_DAILY_LABOR_ROSTER_SOURCE,
  SADAO_JUNE_2026_MONTHLY_WORKERS,
  yearMonthKey,
} from "../lib/constants/thai-cost";
import { prisma } from "../lib/prisma";
import { calendarDateUTC } from "../lib/reports/period-report-shared";
import {
  computeDailyLaborCost,
  computeDailyLaborLunchTotal,
  computeMonthlyWorkerTotal,
  computeSadaoHandlingCommission,
  SadaoHandlingValidationError,
  sumSadaoMonthlyCost,
} from "../lib/thai-cost/sadao-cost";
import { getSadaoMonthlyCost } from "../lib/thai-cost/sadao-cost-service";

const MARKER = "SELFTEST_THAI_COST_PHASE1";
const YEAR = 2026;
const MONTH = 6;
const PREV_PLACEHOLDER_TOTAL = 43647;

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

function assertClose(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) < 0.001) {
    pass(label, `${actual} === ${expected}`);
  } else {
    fail(label, `expected ${expected}, got ${actual}`);
  }
}

async function cleanupMarkerRows() {
  await prisma.sadaoCrateHandlingDaily.deleteMany({
    where: { notes: { contains: MARKER } },
  });
  await prisma.thaiDailyLaborAttendance.deleteMany({
    where: { notes: { contains: MARKER } },
  });
}

async function seedRealJuneMasters() {
  const keepNames = new Set(
    SADAO_JUNE_2026_MONTHLY_WORKERS.map((w) => w.name)
  );

  for (const w of SADAO_JUNE_2026_MONTHLY_WORKERS) {
    const existing = await prisma.thaiMonthlyWorker.findFirst({
      where: { name: w.name, station: "SADAO" },
    });
    const data = {
      monthlyWage: w.monthlyWage,
      lunchAllowance: w.lunchAllowance,
      fuelAllowance: w.fuelAllowance,
      rentRoomAllowance: w.rentRoomAllowance,
      active: true,
    };
    if (existing) {
      await prisma.thaiMonthlyWorker.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.thaiMonthlyWorker.create({
        data: {
          id: randomUUID(),
          name: w.name,
          station: "SADAO",
          ...data,
        },
      });
    }
  }

  const others = await prisma.thaiMonthlyWorker.findMany({
    where: { station: "SADAO", active: true },
  });
  for (const o of others) {
    if (!keepNames.has(o.name)) {
      await prisma.thaiMonthlyWorker.update({
        where: { id: o.id },
        data: { active: false },
      });
    }
  }

  const yearMonth = yearMonthKey(YEAR, MONTH);
  await prisma.thaiDailyLaborMonthlyRoster.upsert({
    where: { yearMonth_station: { yearMonth, station: "SADAO" } },
    create: {
      id: randomUUID(),
      yearMonth,
      station: "SADAO",
      rosterCount: SADAO_JUNE_2026_DAILY_LABOR_ROSTER_COUNT,
      notes: SADAO_JUNE_2026_DAILY_LABOR_ROSTER_SOURCE,
    },
    update: {
      rosterCount: SADAO_JUNE_2026_DAILY_LABOR_ROSTER_COUNT,
      notes: SADAO_JUNE_2026_DAILY_LABOR_ROSTER_SOURCE,
    },
  });
}

async function main() {
  console.log("=== Thai cost Phase 1 self-test (allowances + BOX) ===\n");

  // 0) Independent overflow guards
  for (const [label, input] of [
    [
      "small overflow",
      {
        smallCrateTotalQty: 10,
        largeCrateTotalQty: 5,
        boxTotalQty: 8,
        smallCrateNoCheckQty: 11,
        largeCrateNoCheckQty: 0,
        boxNoCheckQty: 0,
      },
    ],
    [
      "large overflow",
      {
        smallCrateTotalQty: 10,
        largeCrateTotalQty: 5,
        boxTotalQty: 8,
        smallCrateNoCheckQty: 0,
        largeCrateNoCheckQty: 9,
        boxNoCheckQty: 0,
      },
    ],
    [
      "box overflow",
      {
        smallCrateTotalQty: 10,
        largeCrateTotalQty: 5,
        boxTotalQty: 8,
        smallCrateNoCheckQty: 0,
        largeCrateNoCheckQty: 0,
        boxNoCheckQty: 9,
      },
    ],
  ] as const) {
    try {
      computeSadaoHandlingCommission(input, { holidayRate: false });
      fail(label, "expected throw");
    } catch (e) {
      if (e instanceof SadaoHandlingValidationError) {
        pass(label, e.message);
      } else {
        fail(label, String(e));
      }
    }
  }

  const actor =
    (await prisma.user.findFirst({
      where: { active: true, role: "admin" },
      select: { id: true },
    })) ??
    (await prisma.user.findFirst({
      where: { active: true },
      select: { id: true },
    }));
  if (!actor) throw new Error("No active user for createdBy");

  await cleanupMarkerRows();
  await seedRealJuneMasters();

  // Expected monthly worker totals from PDF
  const expectedMonthlyWage = SADAO_JUNE_2026_MONTHLY_WORKERS.reduce(
    (s, w) => s + w.monthlyWage,
    0
  );
  const expectedMonthlyLunch = SADAO_JUNE_2026_MONTHLY_WORKERS.reduce(
    (s, w) => s + w.lunchAllowance,
    0
  );
  const expectedMonthlyFuel = SADAO_JUNE_2026_MONTHLY_WORKERS.reduce(
    (s, w) => s + w.fuelAllowance,
    0
  );
  const expectedMonthlyRent = SADAO_JUNE_2026_MONTHLY_WORKERS.reduce(
    (s, w) => s + w.rentRoomAllowance,
    0
  );
  const expectedMonthlyWorkerTotal = SADAO_JUNE_2026_MONTHLY_WORKERS.reduce(
    (s, w) => s + computeMonthlyWorkerTotal(w),
    0
  );
  // WIN 7000 + YE MIN 7000 + SOMRAK 15500 = 29500
  assertClose(expectedMonthlyWorkerTotal, 29500, "monthly workers PDF total");

  const rosterCount = SADAO_JUNE_2026_DAILY_LABOR_ROSTER_COUNT;
  const dailyWage = DEFAULT_SADAO_DAILY_WAGE_THB; // 300
  const altWage = 350;

  // Attendance: 3 days at 300, day3 at 350 to prove historical isolation
  const attendanceDays = [
    { day: 1, wage: dailyWage },
    { day: 2, wage: dailyWage },
    { day: 3, wage: altWage },
  ];
  for (const d of attendanceDays) {
    await prisma.thaiDailyLaborAttendance.create({
      data: {
        id: randomUUID(),
        date: calendarDateUTC(YEAR, MONTH, d.day),
        station: "SADAO",
        attendanceCount: rosterCount,
        dailyWage: d.wage,
        notes: MARKER,
        createdBy: actor.id,
      },
    });
  }
  const expectedDailyWageTotal = attendanceDays.reduce(
    (s, d) => s + computeDailyLaborCost(rosterCount, d.wage),
    0
  );
  const expectedDailyLunch = computeDailyLaborLunchTotal(rosterCount);
  assertClose(expectedDailyLunch, 21000, "daily labor LUNCH = 21×1000");

  // Handling with boxes
  const handlingDays = [
    {
      day: 1,
      small: 100,
      large: 40,
      box: 20,
      smallNoCheck: 0,
      largeNoCheck: 0,
      boxNoCheck: 0,
    },
    {
      day: 2,
      small: 80,
      large: 20,
      box: 10,
      smallNoCheck: 0,
      largeNoCheck: 0,
      boxNoCheck: 0,
    },
    {
      day: 3,
      small: 50,
      large: 10,
      box: 15,
      smallNoCheck: 5,
      largeNoCheck: 2,
      boxNoCheck: 3,
    },
  ];

  let expectedSmall = 0;
  let expectedLarge = 0;
  let expectedBox = 0;
  for (const d of handlingDays) {
    const commission = computeSadaoHandlingCommission(
      {
        smallCrateTotalQty: d.small,
        largeCrateTotalQty: d.large,
        boxTotalQty: d.box,
        smallCrateNoCheckQty: d.smallNoCheck,
        largeCrateNoCheckQty: d.largeNoCheck,
        boxNoCheckQty: d.boxNoCheck,
      },
      { holidayRate: false }
    );
    expectedSmall += commission.smallCommissionThb;
    expectedLarge += commission.largeCommissionThb;
    expectedBox += commission.boxCommissionThb;
    await prisma.sadaoCrateHandlingDaily.create({
      data: {
        id: randomUUID(),
        date: calendarDateUTC(YEAR, MONTH, d.day),
        smallCrateTotalQty: d.small,
        largeCrateTotalQty: d.large,
        boxTotalQty: d.box,
        smallCrateNoCheckQty: d.smallNoCheck,
        largeCrateNoCheckQty: d.largeNoCheck,
        boxNoCheckQty: d.boxNoCheck,
        notes: MARKER,
        createdBy: actor.id,
      },
    });
  }

  // day1: 100*3 + 40*4 + 20*3 = 300+160+60 = 520
  assertClose(
    computeSadaoHandlingCommission(
      {
        smallCrateTotalQty: 100,
        largeCrateTotalQty: 40,
        boxTotalQty: 20,
        smallCrateNoCheckQty: 0,
        largeCrateNoCheckQty: 0,
        boxNoCheckQty: 0,
      },
      { holidayRate: false }
    ).totalCommissionThb,
    520,
    "day1 commission with box"
  );

  // day3: (50-5)*3 + (10-2)*4 + (15-3)*3 = 135+32+36 = 203
  assertClose(
    computeSadaoHandlingCommission(
      {
        smallCrateTotalQty: 50,
        largeCrateTotalQty: 10,
        boxTotalQty: 15,
        smallCrateNoCheckQty: 5,
        largeCrateNoCheckQty: 2,
        boxNoCheckQty: 3,
      },
      { holidayRate: false }
    ).totalCommissionThb,
    203,
    "day3 commission with no-check box"
  );

  const expectedParts = sumSadaoMonthlyCost({
    monthlyWageTotalThb: expectedMonthlyWage,
    monthlyLunchTotalThb: expectedMonthlyLunch,
    monthlyFuelTotalThb: expectedMonthlyFuel,
    monthlyRentRoomTotalThb: expectedMonthlyRent,
    dailyLaborWageTotalThb: expectedDailyWageTotal,
    dailyLaborLunchTotalThb: expectedDailyLunch,
    handlingSmallCommissionThb: expectedSmall,
    handlingLargeCommissionThb: expectedLarge,
    handlingBoxCommissionThb: expectedBox,
  });

  // Service must match (only our seeded masters + marker attendance/handling)
  const service = await getSadaoMonthlyCost(YEAR, MONTH);

  assertClose(service.monthlyWageTotalThb, expectedMonthlyWage, "service wage");
  assertClose(service.monthlyLunchTotalThb, expectedMonthlyLunch, "service monthly LUNCH");
  assertClose(service.monthlyFuelTotalThb, expectedMonthlyFuel, "service FUEL");
  assertClose(
    service.monthlyRentRoomTotalThb,
    expectedMonthlyRent,
    "service RENT ROOM"
  );
  assertClose(
    service.monthlyWorkerTotalThb,
    expectedMonthlyWorkerTotal,
    "service monthly worker total"
  );
  assertClose(
    service.dailyLaborWageTotalThb,
    expectedDailyWageTotal,
    "service daily wage"
  );
  assertClose(
    service.dailyLaborLunchTotalThb,
    expectedDailyLunch,
    "service daily LUNCH"
  );
  assertClose(
    service.handlingSmallCommissionThb,
    expectedSmall,
    "service small commission"
  );
  assertClose(
    service.handlingLargeCommissionThb,
    expectedLarge,
    "service large commission"
  );
  assertClose(
    service.handlingBoxCommissionThb,
    expectedBox,
    "service box commission"
  );
  assertClose(service.totalCostThb, expectedParts.totalCostThb, "service total");

  // Historical dailyWage isolation
  const att = await prisma.thaiDailyLaborAttendance.findMany({
    where: { notes: { contains: MARKER } },
    orderBy: { date: "asc" },
  });
  if (Number(att[0]?.dailyWage) === dailyWage) {
    pass("historical dailyWage day1", `frozen at ${dailyWage}`);
  } else {
    fail("historical dailyWage day1", `got ${att[0]?.dailyWage}`);
  }
  if (Number(att[2]?.dailyWage) === altWage) {
    pass("historical dailyWage day3", `frozen at ${altWage}`);
  } else {
    fail("historical dailyWage day3", `got ${att[2]?.dailyWage}`);
  }

  // Four cost families present (wage, LUNCH, FUEL, RENT, commission)
  if (service.monthlyWageTotalThb > 0) pass("has wage", String(service.monthlyWageTotalThb));
  else fail("has wage", "0");
  if (service.monthlyLunchTotalThb + service.dailyLaborLunchTotalThb > 0) {
    pass(
      "has LUNCH",
      `monthly=${service.monthlyLunchTotalThb} daily=${service.dailyLaborLunchTotalThb}`
    );
  } else fail("has LUNCH", "0");
  if (service.monthlyFuelTotalThb > 0) pass("has FUEL", String(service.monthlyFuelTotalThb));
  else fail("has FUEL", "0");
  if (service.monthlyRentRoomTotalThb > 0) {
    pass("has RENT ROOM", String(service.monthlyRentRoomTotalThb));
  } else fail("has RENT ROOM", "0");
  if (service.handlingCommissionTotalThb > 0) {
    pass("has commission", String(service.handlingCommissionTotalThb));
  } else fail("has commission", "0");

  console.log("\n--- June 2026 Sadao cost (real masters + sample 3 days) ---");
  console.log(`  Monthly wage:          ${service.monthlyWageTotalThb.toFixed(2)}`);
  console.log(`  Monthly LUNCH:         ${service.monthlyLunchTotalThb.toFixed(2)}`);
  console.log(`  Monthly FUEL:          ${service.monthlyFuelTotalThb.toFixed(2)}`);
  console.log(`  Monthly RENT ROOM:     ${service.monthlyRentRoomTotalThb.toFixed(2)}`);
  console.log(`  Monthly worker total:  ${service.monthlyWorkerTotalThb.toFixed(2)}`);
  console.log(`  Daily labor wages:     ${service.dailyLaborWageTotalThb.toFixed(2)} (3 sample days)`);
  console.log(`  Daily labor LUNCH:     ${service.dailyLaborLunchTotalThb.toFixed(2)} (21×1000)`);
  console.log(`  Handling small:        ${service.handlingSmallCommissionThb.toFixed(2)}`);
  console.log(`  Handling large:        ${service.handlingLargeCommissionThb.toFixed(2)}`);
  console.log(`  Handling box:          ${service.handlingBoxCommissionThb.toFixed(2)}`);
  console.log(`  Handling total:        ${service.handlingCommissionTotalThb.toFixed(2)}`);
  console.log(`  TOTAL:                ${service.totalCostThb.toFixed(2)} THB`);
  console.log(
    `\n  vs previous placeholder total ${PREV_PLACEHOLDER_TOTAL}: delta = ${(
      service.totalCostThb - PREV_PLACEHOLDER_TOTAL
    ).toFixed(2)}`
  );

  // Fixed-cost baseline (no attendance/handling days yet) for "real masters only"
  const mastersOnly = sumSadaoMonthlyCost({
    monthlyWageTotalThb: expectedMonthlyWage,
    monthlyLunchTotalThb: expectedMonthlyLunch,
    monthlyFuelTotalThb: expectedMonthlyFuel,
    monthlyRentRoomTotalThb: expectedMonthlyRent,
    dailyLaborWageTotalThb: 0,
    dailyLaborLunchTotalThb: expectedDailyLunch,
    handlingSmallCommissionThb: 0,
    handlingLargeCommissionThb: 0,
    handlingBoxCommissionThb: 0,
  });
  console.log("\n--- Masters-only baseline (no attendance/handling days) ---");
  console.log(
    `  Monthly workers ${mastersOnly.monthlyWorkerTotalThb} + daily LUNCH ${mastersOnly.dailyLaborLunchTotalThb} = ${mastersOnly.totalCostThb} THB`
  );
  console.log(
    `  (If June had 30 full days @21×300: daily wages = ${21 * 300 * 30} → grand total = ${
      mastersOnly.totalCostThb + 21 * 300 * 30
    })`
  );

  await cleanupMarkerRows();
  console.log("\nCleanup done (marker attendance/handling removed; masters kept).");

  const failed = checks.filter((c) => !c.ok);
  console.log(
    `\n=== Result: ${checks.length - failed.length}/${checks.length} passed ===`
  );
  if (failed.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
