import { describe, expect, it } from "vitest";
import {
  buildPayrollSummary,
  calculateLindung24Jam,
  calculateStatutoryDeductions,
  crateReturnEarningsDisplayTotal,
  isEisExempt,
} from "@/lib/payroll-statutory";
import { lookupLindung24Jam } from "@/lib/constants/lindung-24-jam-brackets";
import { lookupSocsoContributions } from "@/lib/constants/socso-brackets";
import { lookupSocsoSecondCategoryEmployer } from "@/lib/constants/socso-second-category-brackets";

describe("lookupLindung24Jam (official bracket table)", () => {
  it("ceiling anchor: gross >= 6000 → 44.65 (not 45.00)", () => {
    expect(lookupLindung24Jam(6000)).toBe(44.65);
    expect(lookupLindung24Jam(9000)).toBe(44.65);
    expect(calculateLindung24Jam(6000)).toBe(44.65);
  });

  it("floor anchor: gross <= 30 → 0.20", () => {
    expect(lookupLindung24Jam(30)).toBe(0.2);
    expect(lookupLindung24Jam(20)).toBe(0.2);
  });

  it("mid bracket: gross 4000 → 29.65 per official table", () => {
    expect(lookupLindung24Jam(4000)).toBe(29.65);
  });
});

describe("SOCSO First Category ceiling", () => {
  it("returns employer 104.15 / employee 29.75 at gross >= 6000", () => {
    expect(lookupSocsoContributions(6000)).toEqual({
      employee: 29.75,
      employer: 104.15,
    });
  });
});

describe("SOCSO Second Category + EIS exempt (FOOK)", () => {
  it("employer ceiling 74.40 at gross >= 6000", () => {
    expect(lookupSocsoSecondCategoryEmployer(6000)).toBe(74.4);
  });

  it("employee SOCSO=0, EIS=0, Lindung from bracket table", () => {
    expect(isEisExempt(true)).toBe(true);
    const statutory = calculateStatutoryDeductions({
      grossSalary: 7000,
      maritalStatus: "single",
      childCount: 0,
      isSocsoSecondCategory: true,
    });
    expect(statutory.socsoEmployee).toBe(0);
    expect(statutory.socsoEmployer).toBe(74.4);
    expect(statutory.lindung24Jam).toBe(44.65);
    expect(statutory.eisEmployee).toBe(0);
    expect(statutory.eisEmployer).toBe(0);
  });

  it("FOOK June gross 4540: Lindung 34.15, EIS 0", () => {
    const statutory = calculateStatutoryDeductions({
      grossSalary: 4540,
      maritalStatus: "single",
      childCount: 0,
      isSocsoSecondCategory: true,
    });
    expect(statutory.lindung24Jam).toBe(34.15);
    expect(statutory.eisEmployee).toBe(0);
    expect(statutory.eisEmployer).toBe(0);
    expect(statutory.socsoEmployer).toBe(56.9);
  });
});

describe("net salary deduction order", () => {
  it("deducts EPF → SOCSO → Lindung → EIS → PCB", () => {
    const summary = buildPayrollSummary({
      earnings: {
        baseSalary: 6000,
        tripAllowanceTotal: 0,
        charterSalaryTotal: 0,
        crateCommissionTotal: 0,
        crateMultiMarketTotal: 0,
        tripExtraAllowanceTotal: 0,
        extraAllowanceTotal: 0,
        advanceTotal: 0,
      },
      maritalStatus: "single",
      childCount: 0,
    });

    expect(summary.statutory.socsoEmployee).toBe(29.75);
    expect(summary.statutory.lindung24Jam).toBe(44.65);

    const expectedNet =
      6000 -
      summary.statutory.epfEmployee -
      summary.statutory.socsoEmployee -
      summary.statutory.lindung24Jam -
      summary.statutory.eisEmployee -
      summary.statutory.pcb;
    expect(summary.netSalary).toBe(Math.round(expectedNet * 100) / 100);
  });

  it("supports lindung24Jam manual override", () => {
    const statutory = calculateStatutoryDeductions({
      grossSalary: 6000,
      maritalStatus: null,
      childCount: 0,
      overrides: { lindung24Jam: 40 },
    });
    expect(statutory.lindung24Jam).toBe(40);
  });
});

describe("crateReturnEarningsDisplayTotal", () => {
  it("sums commission and multi-market for display only", () => {
    expect(
      crateReturnEarningsDisplayTotal({
        crateCommissionTotal: 500,
        crateMultiMarketTotal: 30,
      })
    ).toBe(530);
  });
});
