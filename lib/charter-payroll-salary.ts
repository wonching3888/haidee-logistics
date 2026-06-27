import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export type CharterDriverSalarySource = "payroll" | "charter_fallback";

/**
 * Resolve charter driver salary for P&L / ops cost.
 * Payroll charterSalary is the primary source; charterDriverSalaryMyr is fallback when no payroll row.
 */
export function resolveCharterDriverSalaryMyr(
  trip: { id?: string; charterDriverSalaryMyr: unknown },
  payrollCharterSalaryMyr: number | undefined,
  options?: { warnOnFallback?: boolean }
): { driverSalaryMyr: number; source: CharterDriverSalarySource } {
  if (payrollCharterSalaryMyr !== undefined) {
    return { driverSalaryMyr: payrollCharterSalaryMyr, source: "payroll" };
  }

  const fallback = decimalToNumber(trip.charterDriverSalaryMyr) ?? 0;
  if (options?.warnOnFallback && fallback > 0 && trip.id) {
    console.warn(
      `[charter-pnl] Missing payroll row for charter ${trip.id}; using charterDriverSalaryMyr=${fallback}`
    );
  }
  return { driverSalaryMyr: fallback, source: "charter_fallback" };
}

export async function loadPayrollCharterSalaryByTripId(
  charterTripIds: string[]
): Promise<Map<string, number>> {
  if (charterTripIds.length === 0) return new Map();

  const rows = await prisma.driverPayrollTrip.findMany({
    where: { charterTripId: { in: charterTripIds } },
    select: { charterTripId: true, charterSalary: true },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.charterTripId) {
      map.set(row.charterTripId, decimalToNumber(row.charterSalary) ?? 0);
    }
  }
  return map;
}

export async function sumPayrollCharterSalaryForMonth(
  year: number,
  month: number
): Promise<number> {
  const { start, end } = getMonthDateRange(year, month);
  const rows = await prisma.driverPayrollTrip.findMany({
    where: {
      charterTripId: { not: null },
      date: { gte: start, lte: end },
    },
    select: { charterSalary: true },
  });

  return roundMoney(
    rows.reduce((sum, row) => sum + (decimalToNumber(row.charterSalary) ?? 0), 0)
  );
}

export async function attachPayrollCharterSalaries<
  T extends { id: string; charterDriverSalaryMyr: unknown },
>(trips: T[]): Promise<Array<T & { payrollCharterSalaryMyr?: number }>> {
  const salaryByTripId = await loadPayrollCharterSalaryByTripId(
    trips.map((trip) => trip.id)
  );
  return trips.map((trip) => ({
    ...trip,
    payrollCharterSalaryMyr: salaryByTripId.get(trip.id),
  }));
}
