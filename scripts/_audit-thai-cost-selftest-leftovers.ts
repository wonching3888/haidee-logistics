/**
 * Count leftover self-test rows (July/August markers + snapshots).
 * Run: npx tsx --env-file=.env.local scripts/_audit-thai-cost-selftest-leftovers.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "../lib/prisma";
import { calendarDateUTC } from "../lib/reports/period-report-shared";

async function main() {
  const julStart = calendarDateUTC(2026, 7, 1);
  const julEnd = calendarDateUTC(2026, 7, 31);
  const augStart = calendarDateUTC(2026, 8, 1);
  const augEnd = calendarDateUTC(2026, 8, 31);

  const counts = {
    songkhlaHandling_marker: await prisma.songkhlaCrateHandlingDaily.count({
      where: { notes: { contains: "SELFTEST" } },
    }),
    pattaniHandling_marker: await prisma.pattaniCrateHandlingDaily.count({
      where: { notes: { contains: "SELFTEST" } },
    }),
    attendance_marker: await prisma.thaiDailyLaborAttendance.count({
      where: { notes: { contains: "SELFTEST" } },
    }),
    driverTrips_marker: await prisma.thaiDriverTripDaily.count({
      where: { notes: { contains: "SELFTEST" } },
    }),
    monthlyWorkers_marker: await prisma.thaiMonthlyWorker.count({
      where: { name: { startsWith: "SELFTEST" } },
    }),
    roster_july_songkhla: await prisma.thaiDailyLaborMonthlyRoster.count({
      where: {
        yearMonth: "2026-07",
        station: "SONGKHLA",
        notes: { contains: "SELFTEST" },
      },
    }),
    rateSnap_2026_07: await prisma.thaiCostMonthlyRateSnapshot.count({
      where: { yearMonth: "2026-07" },
    }),
    rateSnap_2026_08: await prisma.thaiCostMonthlyRateSnapshot.count({
      where: { yearMonth: "2026-08" },
    }),
    segmentSnap_2026_07: await prisma.thaiSegmentInternalCostSnapshot.count({
      where: { yearMonth: "2026-07" },
    }),
    segmentSnap_2026_08: await prisma.thaiSegmentInternalCostSnapshot.count({
      where: { yearMonth: "2026-08" },
    }),
    songkhlaHandling_aug: await prisma.songkhlaCrateHandlingDaily.count({
      where: { date: { gte: augStart, lte: augEnd } },
    }),
    pattaniHandling_aug: await prisma.pattaniCrateHandlingDaily.count({
      where: { date: { gte: augStart, lte: augEnd } },
    }),
    songkhlaHandling_jul: await prisma.songkhlaCrateHandlingDaily.count({
      where: { date: { gte: julStart, lte: julEnd } },
    }),
    sakri: await prisma.thaiMonthlyWorker.count({
      where: { name: "SAKRI", station: "PATTANI" },
    }),
  };

  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
