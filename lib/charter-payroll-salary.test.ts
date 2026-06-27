import { describe, expect, it, vi } from "vitest";
import { resolveCharterDriverSalaryMyr } from "@/lib/charter-payroll-salary";
import { computeCharterPnlRow, type CharterTripPnlInput } from "@/lib/charter-pnl";

const GLOBAL_COSTS = {
  fuelPriceMyr: 2.5,
  epermit: 35,
  dagangNet: 15,
  forwardingOutbound: 50,
  forwardingReturn: 30,
  borderPass: 100,
};

function minimalCharterTrip(
  overrides: Partial<CharterTripPnlInput> = {}
): CharterTripPnlInput {
  return {
    id: "charter-1",
    charterNo: "CH-TEST-001",
    date: new Date("2026-06-21"),
    driverName: "Pinat",
    shipperId: null,
    billToCustomerName: "Test",
    includeBorderFees: false,
    charterMileageKm: 100,
    charterRevenueMyr: 1000,
    charterUnloadFeeMyr: 0,
    charterUnloadFeeOverride: null,
    charterBorderPassOverride: null,
    charterDriverSalaryMyr: 200,
    charterOtherCostMyr: 0,
    charterOtherCostOverride: null,
    charterLoadingLaborMyr: 0,
    charterTollMyr: 0,
    totalQuantity: 10,
    computedLkimMyr: 0,
    computedCrateRentalMyr: 0,
    truck: {
      plate: "VNN3888",
      fuelEfficiencyKmPerL: 4,
      annualMileageKm: 50000,
      costItems: [{ annualAmount: 12000 }],
    },
    extraItems: [],
    ...overrides,
  };
}

describe("resolveCharterDriverSalaryMyr", () => {
  it("uses payroll charterSalary when provided", () => {
    const result = resolveCharterDriverSalaryMyr(
      { id: "c1", charterDriverSalaryMyr: 999 },
      210
    );
    expect(result).toEqual({ driverSalaryMyr: 210, source: "payroll" });
  });

  it("falls back to charterDriverSalaryMyr when payroll row missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = resolveCharterDriverSalaryMyr(
      { id: "c1", charterDriverSalaryMyr: 260 },
      undefined,
      { warnOnFallback: true }
    );
    expect(result).toEqual({ driverSalaryMyr: 260, source: "charter_fallback" });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("uses payroll zero instead of fallback when payroll row exists with 0", () => {
    const result = resolveCharterDriverSalaryMyr(
      { id: "c1", charterDriverSalaryMyr: 260 },
      0
    );
    expect(result).toEqual({ driverSalaryMyr: 0, source: "payroll" });
  });
});

describe("computeCharterPnlRow payroll driver salary", () => {
  it("embeds payroll charterSalary in shipper direct cost", () => {
    const row = computeCharterPnlRow(
      {
        ...minimalCharterTrip(),
        payrollCharterSalaryMyr: 210,
        charterDriverSalaryMyr: 999,
      },
      GLOBAL_COSTS
    )!;

    expect(row.shippers[0]?.driverSalaryMyr).toBe(210);
    expect(row.vehicleCosts.driverMyr).toBe(0);
  });

  it("matches charterDriverSalaryMyr when payroll missing (fallback)", () => {
    const row = computeCharterPnlRow(
      minimalCharterTrip({ charterDriverSalaryMyr: 260 }),
      GLOBAL_COSTS
    )!;

    expect(row.shippers[0]?.driverSalaryMyr).toBe(260);
  });
});
