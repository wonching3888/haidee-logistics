import { yearMonthKey } from "@/lib/constants/thai-cost";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

export type ThaiPnlStation = "SONGKHLA" | "PATTANI";

export interface PnlCompleteness {
  /** Human-readable cost labels that are missing (no "不含" prefix). */
  missingCostLabels: string[];
  /** Full warning banner text, or null when P&L is complete. */
  incompleteWarning: string | null;
}

/**
 * Build: "⚠ 该P&L不含A、不含B，数字仅供参考"
 */
export function formatPnlIncompleteWarning(
  missingCostLabels: string[]
): string | null {
  if (missingCostLabels.length === 0) return null;
  const parts = missingCostLabels.map((label) => `不含${label}`);
  return `⚠ 该P&L${parts.join("、")}，数字仅供参考`;
}

/**
 * Generic P&L completeness checks for Songkhla / Pattani.
 * Warnings auto-clear when the underlying records are filled in.
 */
export async function detectThaiPnlCompleteness(
  station: ThaiPnlStation,
  year: number,
  month: number
): Promise<PnlCompleteness> {
  const ym = yearMonthKey(year, month);
  const { start, end } = getMonthDateRange(year, month);

  const [workerCount, attendanceCount, roster, rentedTrips] =
    await Promise.all([
      prisma.thaiMonthlyWorker.count({
        where: { station, active: true },
      }),
      prisma.thaiDailyLaborAttendance.count({
        where: { station, date: { gte: start, lte: end } },
      }),
      prisma.thaiDailyLaborMonthlyRoster.findUnique({
        where: { yearMonth_station: { yearMonth: ym, station } },
      }),
      prisma.thaiRentedVehicleTrip.findMany({
        where: { station, date: { gte: start, lte: end } },
        select: { tripCost: true },
      }),
    ]);

  const rentedCostThb = rentedTrips.reduce(
    (sum, row) => sum + (decimalToNumber(row.tripCost) ?? 0),
    0
  );
  const hasRoster =
    roster != null && Number.isFinite(roster.rosterCount) && roster.rosterCount > 0;

  const missing: string[] = [];

  if (station === "SONGKHLA") {
    const missingMonthly = workerCount === 0;
    const missingDailyWage = attendanceCount === 0;
    const missingDailyLunch = !hasRoster;

    if (missingMonthly && missingDailyWage) {
      // Lunch is also absent when there is no daily-labor setup.
      missing.push("搬运工月薪/日薪成本");
    } else {
      if (missingMonthly) missing.push("搬运工月薪成本");
      if (missingDailyWage) {
        missing.push("日薪成本");
      } else if (missingDailyLunch) {
        missing.push("日薪LUNCH成本");
      }
    }
  } else {
    // Pattani: SAKRI monthly wage only (no daily-labor cost line).
    if (workerCount === 0) {
      missing.push("SAKRI月薪成本");
    }
  }

  // External rented vehicles: warn until at least one cost row exists.
  if (rentedTrips.length === 0 || rentedCostThb <= 0) {
    missing.push("外部租车成本");
  }

  return {
    missingCostLabels: missing,
    incompleteWarning: formatPnlIncompleteWarning(missing),
  };
}
