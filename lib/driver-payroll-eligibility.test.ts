import { describe, expect, it } from "vitest";
import {
  isDriverEligibleForPayrollMonth,
  payrollEligibilitySkipReason,
  terminationDateToIndex,
  yearMonthToIndex,
} from "@/lib/driver-payroll-eligibility";

describe("driver payroll eligibility", () => {
  const termDate = new Date("2026-06-10T00:00:00.000Z");

  it("indexes year/month and termination date consistently", () => {
    expect(yearMonthToIndex(2026, 6)).toBe(terminationDateToIndex(termDate));
    expect(yearMonthToIndex(2026, 7)).toBeGreaterThan(
      terminationDateToIndex(termDate)
    );
  });

  it("active driver without termination stays eligible", () => {
    expect(
      isDriverEligibleForPayrollMonth({ active: true, terminationDate: null }, 2026, 7)
    ).toBe(true);
  });

  it("inactive driver without termination is excluded", () => {
    expect(
      isDriverEligibleForPayrollMonth({ active: false, terminationDate: null }, 2026, 6)
    ).toBe(false);
  });

  it("terminated driver: June eligible, July excluded while active=true", () => {
    const driver = { active: true, terminationDate: termDate };
    expect(isDriverEligibleForPayrollMonth(driver, 2026, 6)).toBe(true);
    expect(isDriverEligibleForPayrollMonth(driver, 2026, 7)).toBe(false);
  });

  it("returns skip reason for post-termination month", () => {
    expect(
      payrollEligibilitySkipReason(
        { active: true, terminationDate: termDate, name: "Din" },
        2026,
        7
      )
    ).toContain("Terminated after");
  });
});
