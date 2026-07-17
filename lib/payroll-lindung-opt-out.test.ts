import { describe, expect, it } from "vitest";
import { buildDriverPayrollSummaryFromRecords } from "@/lib/payroll-fleet";
import { calculateLindung24Jam } from "@/lib/payroll-statutory";

describe("lindung24JamOptOut injection", () => {
  const baseDriver = {
    id: "d1",
    name: "Test",
    baseSalary: 4000,
    maritalStatus: "single" as const,
    spouseWorking: null,
    childCount: 0,
    isSocsoSecondCategory: false,
  };

  it("optOut=false keeps auto Lindung from bracket", () => {
    const summary = buildDriverPayrollSummaryFromRecords({
      driver: { ...baseDriver, lindung24JamOptOut: false },
      trips: [],
      extras: [],
    });
    expect(summary.statutory.lindung24Jam).toBe(calculateLindung24Jam(4000));
  });

  it("optOut=true forces Lindung=0 when month override is null", () => {
    const summary = buildDriverPayrollSummaryFromRecords({
      driver: { ...baseDriver, lindung24JamOptOut: true },
      trips: [],
      extras: [],
      overrides: { lindung24JamOverride: null },
    });
    expect(summary.statutory.lindung24Jam).toBe(0);
  });

  it("month lindung override still wins over optOut", () => {
    const summary = buildDriverPayrollSummaryFromRecords({
      driver: { ...baseDriver, lindung24JamOptOut: true },
      trips: [],
      extras: [],
      overrides: { lindung24JamOverride: 12.34 },
    });
    expect(summary.statutory.lindung24Jam).toBe(12.34);
  });
});
