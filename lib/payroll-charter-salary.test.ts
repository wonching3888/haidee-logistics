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

describe("company payroll includes charterSalary (Step 2+3)", () => {
  it("includes charterSalary in company gross and totalCostMyr", () => {
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
    expect(company.grossSalary).toBe(210);
    expect(payrollCompanyCostMyr(company)).toBe(payrollCompanyCostMyr(full));

    const row = payrollSummaryToRow(driver, full, true);
    const aggregate = aggregateFleetPayrollRows(
      [row],
      new Map([[driver.id, payrollCompanyCostMyr(company)]])
    );

    expect(aggregate.totalCostMyr).toBe(payrollCompanyCostMyr(company));
    expect(aggregate.driverTotalCostMyr).toBe(payrollCompanyCostMyr(full));
  });

  it("adds charter salary to company cost vs commission-only baseline", () => {
    const commissionOnly = buildPayrollSummary({
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

    const withCharter = buildCompanyPayrollSummaryFromRecords({
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

    expect(payrollCompanyCostMyr(withCharter)).toBeGreaterThan(
      payrollCompanyCostMyr(commissionOnly)
    );
  });
});
