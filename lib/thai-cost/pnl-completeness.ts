import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { THAI_VEHICLE_RENTED_NOTES_PREFIX } from "@/lib/thai-cost/thai-vehicle-pnl-constants";

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
 * Completeness for Thai-vehicle PNL (THB).
 * Warns when station monthly workers missing, or RENTED trips lack matching trip_cost.
 */
export async function detectThaiPnlCompleteness(
  station: ThaiPnlStation,
  year: number,
  month: number
): Promise<PnlCompleteness> {
  const { start, end } = getMonthDateRange(year, month);

  const [workerCount, rentedVehicleTrips, rentedCostRows] = await Promise.all([
    prisma.thaiMonthlyWorker.count({
      where: { station, active: true },
    }),
    prisma.thaiVehicleTripDaily.findMany({
      where: {
        station,
        date: { gte: start, lte: end },
        notes: { startsWith: THAI_VEHICLE_RENTED_NOTES_PREFIX },
      },
      select: { notes: true, truckPlate: true, date: true },
    }),
    prisma.thaiRentedVehicleTrip.findMany({
      where: { station, date: { gte: start, lte: end } },
      select: { tripCost: true, driverName: true, truckPlate: true, date: true },
    }),
  ]);

  const missing: string[] = [];

  if (workerCount === 0) {
    missing.push(
      station === "PATTANI" ? "SAKRI/搬运工月薪" : "搬运工月薪成本"
    );
  }

  if (rentedVehicleTrips.length > 0) {
    const costKeys = new Set(
      rentedCostRows.map((r) => {
        const d = r.date.toISOString().slice(0, 10);
        const plate = (r.truckPlate ?? "").replace(/[\s-]/g, "").toUpperCase();
        return `${d}|${plate}|${r.driverName.trim().toUpperCase()}`;
      })
    );
    const unmatched = rentedVehicleTrips.some((t) => {
      const m = t.notes?.match(/^RENTED:([^;]+)/);
      const name = m?.[1]?.trim().toUpperCase() ?? "";
      const d = t.date.toISOString().slice(0, 10);
      const plate = t.truckPlate.replace(/[\s-]/g, "").toUpperCase();
      return !costKeys.has(`${d}|${plate}|${name}`);
    });
    const anyPositive = rentedCostRows.some(
      (r) => (decimalToNumber(r.tripCost) ?? 0) > 0
    );
    if (unmatched || !anyPositive) {
      missing.push("外部租车成本");
    }
  }

  return {
    missingCostLabels: missing,
    incompleteWarning: formatPnlIncompleteWarning(missing),
  };
}
