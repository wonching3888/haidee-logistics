import { describe, expect, it } from "vitest";
import { buildPayrollSummary } from "@/lib/payroll-statutory";
import {
  aggregateFleetPayrollRows,
  buildCompanyPayrollSummaryFromRecords,
  buildDriverPayrollSummaryFromRecords,
  payrollCompanyCostMyr,
  payrollSummaryToRow,
} from "@/lib/payroll-fleet";

const driver = {
  id: "d1",
  name: "Pinat",
  baseSalary: 0,
  maritalStatus: null as const,
  childCount: 0,
};

describe("charterSalary in payroll gross", () => {
  it("includes charterSalary in driver gross and statutory", () => {
    const summary = buildDriverPayrollSummaryFromRecords({
      driver,
      trips: [
        {
          tripAllowance: 0,
          charterSalary: 210,
          extraAllowance: 0,
          crateReturnCommission: 0,
        },
      ],
      extras: [],
    });

    expect(summary.charterSalaryTotal).toBe(210);
    expect(summary.grossSalary).toBe(210);
    expect(summary.statutory.epfEmployee).toBeGreaterThan(0);
  });

  it("keeps charterSalary separate from tripAllowance and commission", () => {
    const summary = buildDriverPayrollSummaryFromRecords({
      driver,
      trips: [
        {
          tripAllowance: 0,
          charterSalary: 260,
          extraAllowance: 0,
          crateReturnCommission: 50,
        },
      ],
      extras: [],
    });

    expect(summary.tripAllowanceTotal).toBe(0);
    expect(summary.charterSalaryTotal).toBe(260);
    expect(summary.crateCommissionTotal).toBe(50);
    expect(summary.grossSalary).toBe(310);
  });
});

describe("company payroll cost isolation (Step 1)", () => {
  it("excludes charterSalary from company totalCostMyr", () => {
    const trips = [
      {
        tripAllowance: 0,
        charterSalary: 210,
        extraAllowance: 0,
        crateReturnCommission: 0,
      },
    ];

    const full = buildDriverPayrollSummaryFromRecords({
      driver,
      trips,
      extras: [],
    });
    const company = buildCompanyPayrollSummaryFromRecords({
      driver,
      trips,
      extras: [],
    });

    expect(full.grossSalary).toBe(210);
    expect(company.grossSalary).toBe(0);
    expect(payrollCompanyCostMyr(full)).toBeGreaterThan(
      payrollCompanyCostMyr(company)
    );

    const row = payrollSummaryToRow(driver, full, true);
    const aggregate = aggregateFleetPayrollRows(
      [row],
      new Map([[driver.id, payrollCompanyCostMyr(company)]])
    );

    expect(aggregate.driverTotalCostMyr).toBeGreaterThan(0);
    expect(aggregate.totalCostMyr).toBe(payrollCompanyCostMyr(company));
    expect(aggregate.totalCostMyr).toBeLessThan(aggregate.driverTotalCostMyr);
  });

  it("matches pre-charter company cost when only charter salary added", () => {
    const withoutCharter = buildPayrollSummary({
      earnings: {
        baseSalary: 0,
        tripAllowanceTotal: 0,
        charterSalaryTotal: 0,
        crateCommissionTotal: 50,
        tripExtraAllowanceTotal: 0,
        extraAllowanceTotal: 0,
        advanceTotal: 0,
      },
      maritalStatus: null,
      childCount: 0,
    });

    const withCharterCompany = buildCompanyPayrollSummaryFromRecords({
      driver,
      trips: [
        {
          tripAllowance: 0,
          charterSalary: 260,
          extraAllowance: 0,
          crateReturnCommission: 50,
        },
      ],
      extras: [],
    });

    expect(payrollCompanyCostMyr(withCharterCompany)).toBe(
      payrollCompanyCostMyr(withoutCharter)
    );
  });
});
