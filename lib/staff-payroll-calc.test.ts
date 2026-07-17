import { describe, expect, it } from "vitest";
import { lookupEpfContributions } from "@/lib/constants/epf-brackets";
import { calculateStatutoryDeductions } from "@/lib/payroll-statutory";
import { buildStaffMonthPayrollSummary } from "@/lib/staff-payroll-calc";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

describe("staff employer EPF flat 13% default", () => {
  it("no override, base under RM5k → round(base * 0.13)", () => {
    const summary = buildStaffMonthPayrollSummary({
      baseSalary: 3100,
      maritalStatus: "married",
      spouseWorking: true,
      childCount: 0,
      year: 2026,
      month: 7,
    });
    expect(summary.statutory.epfEmployer).toBe(roundMoney(3100 * 0.13));
  });

  it("no override, base 8500 → 1105, not table 1020", () => {
    const summary = buildStaffMonthPayrollSummary({
      baseSalary: 8500,
      maritalStatus: "single",
      childCount: 0,
      year: 2026,
      month: 7,
    });
    expect(summary.statutory.epfEmployer).toBe(1105);
    expect(lookupEpfContributions(8500).employer).toBe(1020);
  });

  it("month epfEmployerOverride wins", () => {
    const summary = buildStaffMonthPayrollSummary({
      baseSalary: 8500,
      maritalStatus: "single",
      childCount: 0,
      year: 2026,
      month: 7,
      monthOverrides: { epfEmployerOverride: 1200 },
    });
    expect(summary.statutory.epfEmployer).toBe(1200);
  });

  it("other statutory fields match law engine; only epfEmployer differs", () => {
    const viaPolicy = buildStaffMonthPayrollSummary({
      baseSalary: 8500,
      maritalStatus: "married",
      spouseWorking: true,
      childCount: 0,
      year: 2026,
      month: 7,
    });
    const viaLaw = calculateStatutoryDeductions({
      grossSalary: 8500,
      maritalStatus: "married",
      spouseWorking: true,
      childCount: 0,
      payrollYear: 2026,
      payrollMonth: 7,
    });
    expect(viaPolicy.statutory.epfEmployee).toBe(viaLaw.epfEmployee);
    expect(viaPolicy.statutory.socsoEmployee).toBe(viaLaw.socsoEmployee);
    expect(viaPolicy.statutory.socsoEmployer).toBe(viaLaw.socsoEmployer);
    expect(viaPolicy.statutory.eisEmployee).toBe(viaLaw.eisEmployee);
    expect(viaPolicy.statutory.eisEmployer).toBe(viaLaw.eisEmployer);
    expect(viaPolicy.statutory.lindung24Jam).toBe(viaLaw.lindung24Jam);
    expect(viaPolicy.statutory.pcb).toBe(viaLaw.pcb);
    expect(viaPolicy.statutory.epfEmployer).toBe(1105);
    expect(viaLaw.epfEmployer).toBe(1020);
  });
});
