/**
 * Backfill June 2026 Sadao attendance + handling from confirmed plan.
 *
 * Run: npx tsx --env-file=.env.local scripts/_backfill-sadao-june-2026.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { calendarDateUTC, getMonthDateRange } from "../lib/reports/period-report-shared";
import { toDateInputValue } from "../lib/date-utils";
import { getSadaoMonthlyCost } from "../lib/thai-cost/sadao-cost-service";
import { isHolidayRate, buildPublicHolidayKeySet } from "../lib/thai-cost/holiday";
import { computeSadaoHandlingCommission } from "../lib/thai-cost/sadao-cost";

const YEAR = 2026;
const MONTH = 6;
const ATT_NOTES = "JUNE2026_BACKFILL clerk-confirmed full roster";
const HANDLING_NOTES =
  "JUNE2026_BACKFILL from dispatch (all assigned, pickup-agnostic)";

/** Exact daily handling from investigation report (scheme 1). */
const HANDLING_DAYS: ReadonlyArray<{
  day: number;
  small: number;
  large: number;
  box: number;
}> = [
  { day: 1, small: 729, large: 70, box: 61 },
  { day: 2, small: 494, large: 46, box: 10 },
  { day: 3, small: 401, large: 31, box: 11 },
  { day: 4, small: 330, large: 8, box: 27 },
  { day: 5, small: 420, large: 61, box: 31 },
  { day: 6, small: 466, large: 43, box: 79 },
  { day: 8, small: 966, large: 11, box: 24 },
  { day: 9, small: 738, large: 37, box: 27 },
  { day: 10, small: 862, large: 14, box: 20 },
  { day: 11, small: 704, large: 60, box: 55 },
  { day: 12, small: 718, large: 42, box: 46 },
  { day: 13, small: 1013, large: 115, box: 41 },
  { day: 15, small: 1291, large: 73, box: 53 },
  { day: 16, small: 1056, large: 79, box: 35 },
  { day: 17, small: 766, large: 29, box: 19 },
  { day: 18, small: 590, large: 45, box: 15 },
  { day: 19, small: 797, large: 9, box: 65 },
  { day: 20, small: 549, large: 38, box: 32 },
  { day: 22, small: 1024, large: 49, box: 41 },
  { day: 23, small: 936, large: 31, box: 29 },
  { day: 24, small: 953, large: 26, box: 45 },
  { day: 25, small: 1155, large: 91, box: 46 },
  { day: 26, small: 925, large: 87, box: 97 },
  { day: 27, small: 603, large: 97, box: 39 },
  { day: 29, small: 1112, large: 152, box: 48 },
  { day: 30, small: 739, large: 73, box: 38 },
];

async function main() {
  const { start, end, lastDay } = getMonthDateRange(YEAR, MONTH);

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

  const [existingAtt, existingHandling] = await Promise.all([
    prisma.thaiDailyLaborAttendance.findMany({
      where: { station: "SADAO", date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    }),
    prisma.sadaoCrateHandlingDaily.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    }),
  ]);

  console.log("=== Existing June 2026 rows (before write) ===");
  console.log(`attendance: ${existingAtt.length} rows`);
  for (const r of existingAtt) {
    console.log(
      `  ${toDateInputValue(r.date)} count=${r.attendanceCount} wage=${r.dailyWage} notes=${r.notes ?? ""}`
    );
  }
  console.log(`handling: ${existingHandling.length} rows`);
  for (const r of existingHandling) {
    console.log(
      `  ${toDateInputValue(r.date)} small=${r.smallCrateTotalQty} large=${r.largeCrateTotalQty} box=${r.boxTotalQty} notes=${r.notes ?? ""}`
    );
  }
  console.log(
    "\nConflict policy: UPSERT by unique key (date+station / date)."
  );
  console.log(
    "Existing rows will be OVERWRITTEN with backfill values (not skipped).\n"
  );

  // Build attendance plan (30 days)
  const attendancePlan = [];
  for (let d = 1; d <= lastDay; d++) {
    attendancePlan.push({
      date: calendarDateUTC(YEAR, MONTH, d),
      dateKey: `${YEAR}-06-${String(d).padStart(2, "0")}`,
      attendanceCount: 21,
      dailyWage: 300,
      notes: ATT_NOTES,
    });
  }

  const handlingPlan = HANDLING_DAYS.map((h) => ({
    date: calendarDateUTC(YEAR, MONTH, h.day),
    dateKey: `${YEAR}-06-${String(h.day).padStart(2, "0")}`,
    smallCrateTotalQty: h.small,
    largeCrateTotalQty: h.large,
    boxTotalQty: h.box,
    smallCrateNoCheckQty: 0,
    largeCrateNoCheckQty: 0,
    boxNoCheckQty: 0,
    notes: HANDLING_NOTES,
  }));

  console.log("=== FINAL PREVIEW: attendance (30 rows) ===");
  console.log("date,station,attendanceCount,dailyWage,dayCost,notes");
  for (const a of attendancePlan) {
    console.log(
      `${a.dateKey},SADAO,${a.attendanceCount},${a.dailyWage},${a.attendanceCount * a.dailyWage},${a.notes}`
    );
  }
  console.log(
    `attendance total: ${attendancePlan.length * 21 * 300} THB\n`
  );

  console.log("=== FINAL PREVIEW: handling (26 rows) ===");
  console.log(
    "date,small,large,box,noCheckSmall,noCheckLarge,noCheckBox,notes"
  );
  let sumS = 0;
  let sumL = 0;
  let sumB = 0;
  for (const h of handlingPlan) {
    sumS += h.smallCrateTotalQty;
    sumL += h.largeCrateTotalQty;
    sumB += h.boxTotalQty;
    console.log(
      `${h.dateKey},${h.smallCrateTotalQty},${h.largeCrateTotalQty},${h.boxTotalQty},0,0,0,${h.notes}`
    );
  }
  console.log(`handling qty totals: small=${sumS} large=${sumL} box=${sumB} all=${sumS + sumL + sumB}`);
  console.log("");

  // Write attendance
  let attCreated = 0;
  let attUpdated = 0;
  for (const a of attendancePlan) {
    const existing = existingAtt.find(
      (r) => toDateInputValue(r.date) === a.dateKey
    );
    if (existing) {
      await prisma.thaiDailyLaborAttendance.update({
        where: { id: existing.id },
        data: {
          attendanceCount: a.attendanceCount,
          dailyWage: a.dailyWage,
          notes: a.notes,
        },
      });
      attUpdated += 1;
    } else {
      await prisma.thaiDailyLaborAttendance.create({
        data: {
          id: randomUUID(),
          date: a.date,
          station: "SADAO",
          attendanceCount: a.attendanceCount,
          dailyWage: a.dailyWage,
          notes: a.notes,
          createdBy: actor.id,
        },
      });
      attCreated += 1;
    }
  }

  // Write handling
  let handCreated = 0;
  let handUpdated = 0;
  for (const h of handlingPlan) {
    const existing = existingHandling.find(
      (r) => toDateInputValue(r.date) === h.dateKey
    );
    const data = {
      smallCrateTotalQty: h.smallCrateTotalQty,
      largeCrateTotalQty: h.largeCrateTotalQty,
      boxTotalQty: h.boxTotalQty,
      smallCrateNoCheckQty: 0,
      largeCrateNoCheckQty: 0,
      boxNoCheckQty: 0,
      notes: h.notes,
    };
    if (existing) {
      await prisma.sadaoCrateHandlingDaily.update({
        where: { id: existing.id },
        data,
      });
      handUpdated += 1;
    } else {
      await prisma.sadaoCrateHandlingDaily.create({
        data: {
          id: randomUUID(),
          date: h.date,
          ...data,
          createdBy: actor.id,
        },
      });
      handCreated += 1;
    }
  }

  console.log("=== Write result ===");
  console.log(
    `attendance: created=${attCreated} updated=${attUpdated} total=${attCreated + attUpdated}`
  );
  console.log(
    `handling: created=${handCreated} updated=${handUpdated} total=${handCreated + handUpdated}`
  );

  // Verify counts
  const [attAfter, handAfter] = await Promise.all([
    prisma.thaiDailyLaborAttendance.count({
      where: { station: "SADAO", date: { gte: start, lte: end } },
    }),
    prisma.sadaoCrateHandlingDaily.count({
      where: { date: { gte: start, lte: end } },
    }),
  ]);
  console.log(`post-write counts: attendance=${attAfter} handling=${handAfter}`);

  // Monthly summary
  const summary = await getSadaoMonthlyCost(YEAR, MONTH);

  // Handling rate split (weekday vs holiday) for report
  const holidays = await prisma.thaiPublicHoliday.findMany({
    where: { date: { gte: start, lte: end } },
    select: { date: true },
  });
  const holidayKeys = buildPublicHolidayKeySet(holidays);
  const handlingRows = await prisma.sadaoCrateHandlingDaily.findMany({
    where: { date: { gte: start, lte: end } },
  });
  let weekdayComm = 0;
  let holidayComm = 0;
  let weekdayDays = 0;
  let holidayDays = 0;
  for (const row of handlingRows) {
    const holiday = isHolidayRate(row.date, holidayKeys);
    const c = computeSadaoHandlingCommission(
      {
        smallCrateTotalQty: row.smallCrateTotalQty,
        largeCrateTotalQty: row.largeCrateTotalQty,
        boxTotalQty: row.boxTotalQty,
        smallCrateNoCheckQty: row.smallCrateNoCheckQty,
        largeCrateNoCheckQty: row.largeCrateNoCheckQty,
        boxNoCheckQty: row.boxNoCheckQty,
      },
      { holidayRate: holiday }
    );
    if (holiday) {
      holidayComm += c.totalCommissionThb;
      holidayDays += 1;
    } else {
      weekdayComm += c.totalCommissionThb;
      weekdayDays += 1;
    }
  }

  console.log("\n=== June 2026 Sadao monthly cost (post-write) ===");
  console.log(`  Monthly wage:          ${summary.monthlyWageTotalThb.toFixed(2)}`);
  console.log(`  Monthly LUNCH:         ${summary.monthlyLunchTotalThb.toFixed(2)}`);
  console.log(`  Monthly FUEL:          ${summary.monthlyFuelTotalThb.toFixed(2)}`);
  console.log(`  Monthly RENT ROOM:     ${summary.monthlyRentRoomTotalThb.toFixed(2)}`);
  console.log(`  Monthly worker total:  ${summary.monthlyWorkerTotalThb.toFixed(2)}`);
  console.log(`  Daily labor wages:     ${summary.dailyLaborWageTotalThb.toFixed(2)}`);
  console.log(`  Daily labor LUNCH:     ${summary.dailyLaborLunchTotalThb.toFixed(2)}`);
  console.log(`  Handling small:        ${summary.handlingSmallCommissionThb.toFixed(2)}`);
  console.log(`  Handling large:        ${summary.handlingLargeCommissionThb.toFixed(2)}`);
  console.log(`  Handling box:          ${summary.handlingBoxCommissionThb.toFixed(2)}`);
  console.log(`  Handling total:        ${summary.handlingCommissionTotalThb.toFixed(2)}`);
  console.log(
    `    of which weekday (${weekdayDays} days): ${weekdayComm.toFixed(2)}`
  );
  console.log(
    `    of which holiday (${holidayDays} days): ${holidayComm.toFixed(2)}`
  );
  console.log(`  TOTAL:                ${summary.totalCostThb.toFixed(2)} THB`);

  const priorBaseline = 239500;
  console.log(`\n  Prior theoretical baseline (no handling): ${priorBaseline}`);
  console.log(
    `  Delta vs baseline: ${(summary.totalCostThb - priorBaseline).toFixed(2)} (≈ handling commission ${summary.handlingCommissionTotalThb.toFixed(2)})`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
