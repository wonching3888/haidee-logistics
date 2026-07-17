/**
 * Staff month ensure + eligibility (mirrors driver active + terminationDate).
 */
import {
  isDriverEligibleForPayrollMonth,
  type DriverPayrollEligibilityInput,
} from "@/lib/driver-payroll-eligibility";
import { prisma } from "@/lib/prisma";

export function isStaffEligibleForPayrollMonth(
  staff: DriverPayrollEligibilityInput,
  year: number,
  month: number
): boolean {
  return isDriverEligibleForPayrollMonth(staff, year, month);
}

export function parseStaffYearMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("无效年份 Invalid year");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("无效月份 Invalid month");
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

export async function ensureStaffPayrollMonth(
  staffId: string,
  year: number,
  month: number
) {
  const yearMonth = parseStaffYearMonth(year, month);
  await prisma.staffPayrollMonth.upsert({
    where: { staffId_yearMonth: { staffId, yearMonth } },
    create: { staffId, yearMonth },
    update: {},
  });
  return yearMonth;
}
