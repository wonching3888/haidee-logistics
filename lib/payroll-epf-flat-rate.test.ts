import { describe, expect, it } from "vitest";
import { lookupEpfContributions } from "@/lib/constants/epf-brackets";
import {
  buildPayrollSummary,
  calculateStatutoryDeductions,
} from "@/lib/payroll-statutory";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

const emptyEarnings = {
  tripAllowanceTotal: 0,
  charterSalaryTotal: 0,
  crateCommissionTotal: 0,
  crateMultiMarketTotal: 0,
  tripExtraAllowanceTotal: 0,
  extraAllowanceTotal: 0,
  advanceTotal: 0,
};

describe("employer EPF flat 13% default (buildPayrollSummary)", () => {
  it("no override, gross under RM5k → epfEmployer === round(gross * 0.13)", () => {
    const gross = 4000;
    const summary = buildPayrollSummary({
      earnings: { ...emptyEarnings, baseSalary: gross },
      maritalStatus: "single",
      childCount: 0,
    });
    expect(summary.statutory.epfEmployer).toBe(roundMoney(gross * 0.13));
  });

  it("no override, gross above RM5k → flat 13%, not Third Schedule table", () => {
    const gross = 8500;
    const summary = buildPayrollSummary({
      earnings: { ...emptyEarnings, baseSalary: gross },
      maritalStatus: "single",
      childCount: 0,
    });
    const table = lookupEpfContributions(gross).employer;
    const flat = roundMoney(gross * 0.13);
    expect(summary.statutory.epfEmployer).toBe(flat);
    expect(flat).toBe(1105);
    expect(table).toBe(1020);
    expect(summary.statutory.epfEmployer).not.toBe(table);
  });

  it("explicit epfEmployer override wins over flat 13%", () => {
    const summary = buildPayrollSummary({
      earnings: { ...emptyEarnings, baseSalary: 8500 },
      maritalStatus: "single",
      childCount: 0,
      overrides: { epfEmployer: 999 },
    });
    expect(summary.statutory.epfEmployer).toBe(999);
  });

  it("only epfEmployer changes vs direct calculateStatutoryDeductions; other fields identical", () => {
    const gross = 8500;
    const viaPolicy = buildPayrollSummary({
      earnings: { ...emptyEarnings, baseSalary: gross },
      maritalStatus: "married",
      spouseWorking: true,
      childCount: 1,
    });
    const viaLaw = calculateStatutoryDeductions({
      grossSalary: gross,
      maritalStatus: "married",
      spouseWorking: true,
      childCount: 1,
    });
    expect(viaPolicy.statutory.epfEmployee).toBe(viaLaw.epfEmployee);
    expect(viaPolicy.statutory.socsoEmployee).toBe(viaLaw.socsoEmployee);
    expect(viaPolicy.statutory.socsoEmployer).toBe(viaLaw.socsoEmployer);
    expect(viaPolicy.statutory.eisEmployee).toBe(viaLaw.eisEmployee);
    expect(viaPolicy.statutory.eisEmployer).toBe(viaLaw.eisEmployer);
    expect(viaPolicy.statutory.lindung24Jam).toBe(viaLaw.lindung24Jam);
    expect(viaPolicy.statutory.pcb).toBe(viaLaw.pcb);
    expect(viaPolicy.statutory.epfEmployer).not.toBe(viaLaw.epfEmployer);
    expect(viaPolicy.statutory.epfEmployer).toBe(roundMoney(gross * 0.13));
  });
});
