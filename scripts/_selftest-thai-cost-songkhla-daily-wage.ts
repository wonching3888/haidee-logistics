/**
 * Songkhla totalWagePaid mode + Sadao regression + monthly workers.
 * Run: npx tsx --env-file=.env.local scripts/_selftest-thai-cost-songkhla-daily-wage.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { calendarDateUTC } from "../lib/reports/period-report-shared";
import {
  computeDailyLaborDayCost,
} from "../lib/thai-cost/sadao-cost";
import { getSadaoMonthlyCost } from "../lib/thai-cost/sadao-cost-service";
import { getSongkhlaMonthlyRealCost } from "../lib/thai-cost/songkhla-cost-service";

const MARKER = "SELFTEST_SK_DAILY_WAGE";
const YEAR = 2026;
const MONTH = 9; // avoid clobbering June/July production / other selftests

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
  await prisma.thaiDailyLaborAttendance.deleteMany({
    where: { notes: { contains: MARKER } },
  });
  await prisma.thaiMonthlyWorker.deleteMany({
    where: { name: { startsWith: `${MARKER}_` } },
  });
}

async function main() {
  console.log("=== Songkhla daily wage (totalWagePaid) + Sadao regression ===\n");

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

  // Pure unit: totalWagePaid wins over count × unit
  const day = computeDailyLaborDayCost({
    attendanceCount: 10,
    dailyWage: 340,
    totalWagePaid: 3280,
  });
  if (day === 3280 && day !== 10 * 340) {
    pass("totalWagePaid overrides count×unit", `3280 not ${10 * 340}`);
  } else {
    fail("totalWagePaid overrides count×unit", String(day));
  }

  // Seed Songkhla attendance: count=10, unit=999 (trap), total=3280
  await prisma.thaiDailyLaborAttendance.create({
    data: {
      id: randomUUID(),
      date: calendarDateUTC(YEAR, MONTH, 2),
      station: "SONGKHLA",
      attendanceCount: 10,
      dailyWage: 999,
      totalWagePaid: 3280,
      notes: MARKER,
      createdBy: actor.id,
    },
  });
  // Second day: totalWagePaid=0 explicit
  await prisma.thaiDailyLaborAttendance.create({
    data: {
      id: randomUUID(),
      date: calendarDateUTC(YEAR, MONTH, 3),
      station: "SONGKHLA",
      attendanceCount: 8,
      dailyWage: 300,
      totalWagePaid: 0,
      notes: MARKER,
      createdBy: actor.id,
    },
  });

  // Ensure SAMRAN / PRATHUENG exist (production seed names)
  for (const w of [
    { name: "SAMRAN (P.TOY)", monthlyWage: 20000 },
    { name: "PRATHUENG", monthlyWage: 15000 },
  ]) {
    const existing = await prisma.thaiMonthlyWorker.findFirst({
      where: { name: w.name, station: "SONGKHLA" },
    });
    if (existing) {
      await prisma.thaiMonthlyWorker.update({
        where: { id: existing.id },
        data: {
          monthlyWage: w.monthlyWage,
          lunchAllowance: 0,
          fuelAllowance: 0,
          rentRoomAllowance: 0,
          active: true,
        },
      });
    } else {
      await prisma.thaiMonthlyWorker.create({
        data: {
          id: randomUUID(),
          name: w.name,
          station: "SONGKHLA",
          monthlyWage: w.monthlyWage,
          lunchAllowance: 0,
          fuelAllowance: 0,
          rentRoomAllowance: 0,
          active: true,
        },
      });
    }
  }

  // Marker worker must NOT be counted if we only want SAMRAN+PRATHUENG —
  // but other active Songkhla workers may exist. Check named workers totals.
  const sk = await getSongkhlaMonthlyRealCost(YEAR, MONTH);

  if (sk.dailyLaborWageTotalThb === 3280) {
    pass(
      "songkhla daily labor uses totalWagePaid only",
      `dailyLaborWageTotalThb=${sk.dailyLaborWageTotalThb} (not 10*999+8*300)`
    );
  } else {
    fail(
      "songkhla daily labor uses totalWagePaid only",
      `got ${sk.dailyLaborWageTotalThb}`
    );
  }

  if (sk.dailyLaborLunchTotalThb === 0) {
    pass("songkhla daily labor lunch is 0", "no LUNCH for SK daily labor");
  } else {
    fail("songkhla daily labor lunch is 0", String(sk.dailyLaborLunchTotalThb));
  }

  const samran = sk.monthlyWorkers.find((w) => w.name === "SAMRAN (P.TOY)");
  const prathueng = sk.monthlyWorkers.find((w) => w.name === "PRATHUENG");
  if (samran && samran.totalThb === 20000 && samran.lunchAllowance === 0) {
    pass("SAMRAN monthly", `total=${samran.totalThb}`);
  } else {
    fail("SAMRAN monthly", JSON.stringify(samran));
  }
  if (prathueng && prathueng.totalThb === 15000 && prathueng.lunchAllowance === 0) {
    pass("PRATHUENG monthly", `total=${prathueng.totalThb}`);
  } else {
    fail("PRATHUENG monthly", JSON.stringify(prathueng));
  }

  const monthlyFromNamed =
    (samran?.totalThb ?? 0) + (prathueng?.totalThb ?? 0);
  if (sk.monthlyWageTotalThb >= monthlyFromNamed) {
    pass(
      "songkhla monthly wage includes both",
      `monthlyWageTotalThb=${sk.monthlyWageTotalThb} includes ${monthlyFromNamed}`
    );
  } else {
    fail(
      "songkhla monthly wage includes both",
      `got ${sk.monthlyWageTotalThb} < ${monthlyFromNamed}`
    );
  }

  // Sadao regression: June 2026 backfill must still use count × unit
  const sadaoJune = await getSadaoMonthlyCost(2026, 6);
  const expectedSadaoDaily = 30 * 21 * 300; // 30 days × 21 × 300
  if (sadaoJune.dailyLaborWageTotalThb === expectedSadaoDaily) {
    pass(
      "sadao june regression count×unit",
      `dailyLaborWageTotalThb=${sadaoJune.dailyLaborWageTotalThb}`
    );
  } else {
    fail(
      "sadao june regression count×unit",
      `got ${sadaoJune.dailyLaborWageTotalThb} expected ${expectedSadaoDaily}`
    );
  }
  if (sadaoJune.dailyLaborLunchTotalThb === 21 * 1000) {
    pass(
      "sadao june lunch roster×1000",
      `lunch=${sadaoJune.dailyLaborLunchTotalThb}`
    );
  } else {
    fail(
      "sadao june lunch roster×1000",
      `got ${sadaoJune.dailyLaborLunchTotalThb}`
    );
  }

  // Sadao row with null totalWagePaid still uses count×unit even if we set a trap unit
  await prisma.thaiDailyLaborAttendance.create({
    data: {
      id: randomUUID(),
      date: calendarDateUTC(YEAR, MONTH, 5),
      station: "SADAO",
      attendanceCount: 3,
      dailyWage: 400,
      totalWagePaid: null,
      notes: MARKER,
      createdBy: actor.id,
    },
  });
  const sadaoSep = await getSadaoMonthlyCost(YEAR, MONTH);
  if (sadaoSep.dailyLaborWageTotalThb === 3 * 400) {
    pass("sadao null totalWagePaid uses count×unit", "1200");
  } else {
    fail(
      "sadao null totalWagePaid uses count×unit",
      String(sadaoSep.dailyLaborWageTotalThb)
    );
  }

  await cleanup();
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
