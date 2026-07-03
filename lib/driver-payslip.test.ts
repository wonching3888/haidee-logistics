import { describe, expect, it } from "vitest";
import { payslipWagesTotal } from "@/lib/driver-payslip";
import type { PayrollSummary } from "@/lib/payroll-statutory";

function akimJuneSummary(): PayrollSummary {
  return {
    baseSalary: 1700,
    tripAllowanceTotal: 2400,
    charterSalaryTotal: 0,
    crateCommissionTotal: 500,
    crateMultiMarketTotal: 30,
    extraAllowanceTotal: 0,
    advanceTotal: 1800,
    grossSalary: 4630,
    statutory: {
      epfEmployee: 509.3,
      epfEmployer: 601.9,
      socsoEmployee: 23.25,
      socsoEmployer: 81.35,
      lindung24Jam: 34.85,
      eisEmployee: 9.26,
      eisEmployer: 9.26,
      pcb: 0,
    },
    netSalary: 2253.34,
  };
}

describe("payslipWagesTotal", () => {
  it("merges trip, charter, crate display, and allowance for Akim June", () => {
    expect(payslipWagesTotal(akimJuneSummary())).toBe(2930);
  });

  it("includes crate multi-market for Second Category drivers (Fook June JV rev2)", () => {
    const summary: PayrollSummary = {
      ...akimJuneSummary(),
      tripAllowanceTotal: 2460,
      crateCommissionTotal: 350,
      crateMultiMarketTotal: 30,
      grossSalary: 4540,
      statutory: {
        epfEmployee: 499.4,
        epfEmployer: 590.2,
        socsoEmployee: 0,
        socsoEmployer: 56.9,
        lindung24Jam: 34.15,
        eisEmployee: 0,
        eisEmployer: 0,
        pcb: 0,
      },
      netSalary: 2506.45,
      advanceTotal: 1500,
    };
    expect(payslipWagesTotal(summary)).toBe(2840);
  });
});
