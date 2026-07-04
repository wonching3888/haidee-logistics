/**
 * Self-test: Sadao holiday rates (weekday / Sunday / public holiday) + holiday CRUD.
 *
 * Run: npx tsx --env-file=.env.local scripts/_selftest-thai-cost-holiday-rates.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "crypto";
import {
  SUGGESTED_SADAO_HOLIDAY_DAILY_WAGE_THB,
} from "../lib/constants/thai-cost";
import { prisma } from "../lib/prisma";
import { calendarDateUTC } from "../lib/reports/period-report-shared";
import {
  buildPublicHolidayKeySet,
  isHolidayRate,
  toUtcDateKey,
} from "../lib/thai-cost/holiday";
import {
  computeDailyLaborCost,
  computeSadaoHandlingCommission,
} from "../lib/thai-cost/sadao-cost";
import { getSadaoMonthlyCost } from "../lib/thai-cost/sadao-cost-service";

const MARKER = "SELFTEST_THAI_HOLIDAY";
const YEAR = 2026;
const MONTH = 6;

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

const qty = {
  smallCrateTotalQty: 10,
  largeCrateTotalQty: 5,
  boxTotalQty: 4,
  smallCrateNoCheckQty: 0,
  largeCrateNoCheckQty: 0,
  boxNoCheckQty: 0,
};

async function cleanup(actorId: string) {
  await prisma.sadaoCrateHandlingDaily.deleteMany({
    where: { notes: { contains: MARKER } },
  });
  await prisma.thaiDailyLaborAttendance.deleteMany({
    where: { notes: { contains: MARKER } },
  });
  await prisma.thaiPublicHoliday.deleteMany({
    where: { name: { startsWith: MARKER } },
  });
  void actorId;
}

async function main() {
  console.log("=== Thai cost holiday rates self-test ===\n");

  // Pure rate checks
  const weekday = computeSadaoHandlingCommission(qty, { holidayRate: false });
  assertClose(weekday.totalCommissionThb, 10 * 3 + 5 * 4 + 4 * 3, "weekday rates");
  assertClose(weekday.rates.box, weekday.rates.small, "weekday box===small");

  const holiday = computeSadaoHandlingCommission(qty, { holidayRate: true });
  assertClose(holiday.totalCommissionThb, 10 * 5 + 5 * 6 + 4 * 5, "holiday rates");
  assertClose(holiday.rates.box, holiday.rates.small, "holiday box===small");

  assertClose(
    computeDailyLaborCost(21, SUGGESTED_SADAO_HOLIDAY_DAILY_WAGE_THB),
    21 * 400,
    "holiday daily wage 400"
  );

  const actor =
    (await prisma.user.findFirst({
      where: { active: true, role: "admin" },
      select: { id: true },
    })) ??
    (await prisma.user.findFirst({
      where: { active: true },
      select: { id: true },
    }));
  if (!actor) throw new Error("No active user");

  await cleanup(actor.id);

  // CRUD public holiday: Wednesday 2026-06-03
  const publicHolidayDate = calendarDateUTC(YEAR, MONTH, 3);
  const created = await prisma.thaiPublicHoliday.create({
    data: {
      id: randomUUID(),
      date: publicHolidayDate,
      name: `${MARKER}_泼水节`,
      createdBy: actor.id,
    },
  });
  pass("holiday create", created.name);

  const updated = await prisma.thaiPublicHoliday.update({
    where: { id: created.id },
    data: { name: `${MARKER}_泼水节(改)` },
  });
  if (updated.name.endsWith("(改)")) pass("holiday update", updated.name);
  else fail("holiday update", updated.name);

  const listed = await prisma.thaiPublicHoliday.findMany({
    where: { name: { startsWith: MARKER } },
  });
  if (listed.length === 1) pass("holiday list", `count=${listed.length}`);
  else fail("holiday list", `count=${listed.length}`);

  const holidayKeys = buildPublicHolidayKeySet(listed);

  // Dates: Mon 1 (weekday), Sun 7 (sunday), Wed 3 (public holiday)
  const mon = calendarDateUTC(YEAR, MONTH, 1);
  const sun = calendarDateUTC(YEAR, MONTH, 7);
  const wed = publicHolidayDate;

  if (!isHolidayRate(mon, holidayKeys)) pass("Mon not holiday", toUtcDateKey(mon));
  else fail("Mon not holiday", "unexpected holiday");

  if (isHolidayRate(sun, holidayKeys)) pass("Sun is holiday", toUtcDateKey(sun));
  else fail("Sun is holiday", "expected holiday");

  if (isHolidayRate(wed, holidayKeys)) pass("public holiday weekday", toUtcDateKey(wed));
  else fail("public holiday weekday", "expected holiday");

  // Persist handling rows and verify service aggregation
  const days = [
    { date: mon, holidayRate: false },
    { date: sun, holidayRate: true },
    { date: wed, holidayRate: true },
  ];

  let expectedSmall = 0;
  let expectedLarge = 0;
  let expectedBox = 0;
  for (const d of days) {
    const c = computeSadaoHandlingCommission(qty, {
      holidayRate: d.holidayRate,
    });
    expectedSmall += c.smallCommissionThb;
    expectedLarge += c.largeCommissionThb;
    expectedBox += c.boxCommissionThb;
    await prisma.sadaoCrateHandlingDaily.create({
      data: {
        id: randomUUID(),
        date: d.date,
        ...qty,
        notes: MARKER,
        createdBy: actor.id,
      },
    });
  }

  // Holiday attendance at 400
  await prisma.thaiDailyLaborAttendance.create({
    data: {
      id: randomUUID(),
      date: sun,
      station: "SADAO",
      attendanceCount: 21,
      dailyWage: SUGGESTED_SADAO_HOLIDAY_DAILY_WAGE_THB,
      notes: MARKER,
      createdBy: actor.id,
    },
  });

  const service = await getSadaoMonthlyCost(YEAR, MONTH);
  assertClose(
    service.handlingSmallCommissionThb,
    expectedSmall,
    "service small (mixed rates)"
  );
  assertClose(
    service.handlingLargeCommissionThb,
    expectedLarge,
    "service large (mixed rates)"
  );
  assertClose(
    service.handlingBoxCommissionThb,
    expectedBox,
    "service box (mixed rates)"
  );

  // Daily wage includes 21*400 for Sunday (may include other attendance — check >=)
  if (service.dailyLaborWageTotalThb >= 21 * 400) {
    pass(
      "service includes holiday daily wage",
      `dailyLaborWage=${service.dailyLaborWageTotalThb}`
    );
  } else {
    fail(
      "service includes holiday daily wage",
      `dailyLaborWage=${service.dailyLaborWageTotalThb}`
    );
  }

  // Explicit day commissions
  // weekday: 10*3+5*4+4*3 = 30+20+12 = 62
  // holiday: 10*5+5*6+4*5 = 50+30+20 = 100
  // total handling = 62 + 100 + 100 = 262
  assertClose(
    service.handlingCommissionTotalThb,
    62 + 100 + 100,
    "mixed handling total"
  );

  // Delete holiday
  await prisma.thaiPublicHoliday.delete({ where: { id: created.id } });
  const afterDelete = await prisma.thaiPublicHoliday.findMany({
    where: { name: { startsWith: MARKER } },
  });
  if (afterDelete.length === 0) pass("holiday delete", "removed");
  else fail("holiday delete", `remaining=${afterDelete.length}`);

  // After delete, Wed is no longer holiday (unless Sunday — it's not)
  const keysAfter = buildPublicHolidayKeySet(afterDelete);
  if (!isHolidayRate(wed, keysAfter)) {
    pass("public holiday removed from rate check", toUtcDateKey(wed));
  } else {
    fail("public holiday removed from rate check", "still holiday");
  }

  await cleanup(actor.id);
  console.log("\nCleanup done.");

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
