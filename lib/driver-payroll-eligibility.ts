import type { Prisma } from "@prisma/client";

export interface DriverPayrollEligibilityInput {
  active: boolean;
  terminationDate: Date | null;
}

/** Calendar month index for year/month comparisons (month 1–12). */
export function yearMonthToIndex(year: number, month: number): number {
  return year * 12 + month;
}

/** Termination month index (UTC date parts — matches @db.Date storage). */
export function terminationDateToIndex(date: Date): number {
  return date.getUTCFullYear() * 12 + (date.getUTCMonth() + 1);
}

/**
 * Eligible for payroll/JV/payslip/sync in a given calendar month.
 * - No terminationDate: must be active (existing behaviour).
 * - With terminationDate: eligible through termination month inclusive;
 *   excluded from the month after termination.
 */
export function isDriverEligibleForPayrollMonth(
  driver: DriverPayrollEligibilityInput,
  year: number,
  month: number
): boolean {
  if (driver.terminationDate) {
    return (
      yearMonthToIndex(year, month) <=
      terminationDateToIndex(driver.terminationDate)
    );
  }
  return driver.active;
}

export function payrollEligibilitySkipReason(
  driver: DriverPayrollEligibilityInput & { name: string },
  year: number,
  month: number
): string | null {
  if (isDriverEligibleForPayrollMonth(driver, year, month)) {
    return null;
  }
  if (driver.terminationDate) {
    const term = driver.terminationDate.toISOString().slice(0, 10);
    return `离职后不再生成 Terminated after ${term}`;
  }
  return "inactive 不生成 Skipped (inactive driver)";
}

/** Broad DB query — filter with isDriverEligibleForPayrollMonth in application code. */
export function driverQueryCandidatesForPayroll(): Prisma.DriverWhereInput {
  return {
    OR: [{ active: true }, { terminationDate: { not: null } }],
  };
}
