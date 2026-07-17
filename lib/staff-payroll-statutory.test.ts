import { describe, expect, it } from "vitest";
import { lookupEpfContributions } from "@/lib/constants/epf-brackets";
import { lookupLindung24Jam } from "@/lib/constants/lindung-24-jam-brackets";
import { lookupSocsoContributions } from "@/lib/constants/socso-brackets";
import { EIS_RATE, EIS_WAGE_CEILING } from "@/lib/constants/payroll";
import { calculateStatutoryDeductions } from "@/lib/payroll-statutory";
import { buildStaffPayrollSummary } from "@/lib/staff-payroll-statutory";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

describe("buildStaffPayrollSummary", () => {
  it("case A: base 3000 single — matches official EPF/SOCSO/Lindung/EIS lookups", () => {
    const baseSalary = 3000;
    const statutory = calculateStatutoryDeductions({
      grossSalary: baseSalary,
      maritalStatus: "single",
      childCount: 0,
      isSocsoSecondCategory: false,
      // PCB left as override 0 for deterministic statutory-only check this step
      overrides: { pcb: 0 },
    });

    const epf = lookupEpfContributions(baseSalary);
    const socso = lookupSocsoContributions(baseSalary);
    const lindung = lookupLindung24Jam(baseSalary);
    const eis = roundMoney(Math.min(baseSalary, EIS_WAGE_CEILING) * EIS_RATE);

    expect(statutory.epfEmployee).toBe(epf.employee);
    expect(statutory.epfEmployer).toBe(epf.employer);
    expect(statutory.socsoEmployee).toBe(socso.employee);
    expect(statutory.socsoEmployer).toBe(socso.employer);
    expect(statutory.lindung24Jam).toBe(lindung);
    expect(statutory.eisEmployee).toBe(eis);
    expect(statutory.eisEmployer).toBe(eis);
    expect(statutory.pcb).toBe(0);

    const summary = buildStaffPayrollSummary({ baseSalary, statutory });
    expect(summary.baseSalary).toBe(3000);
    expect(summary.grossSalary).toBe(3000);
    expect(summary.netSalary).toBe(
      roundMoney(
        3000 -
          epf.employee -
          socso.employee -
          eis -
          lindung -
          0
      )
    );
  });

  it("case B: base 5000 married — matches official lookups (no second-category SOCSO)", () => {
    const baseSalary = 5000;
    const statutory = calculateStatutoryDeductions({
      grossSalary: baseSalary,
      maritalStatus: "married",
      spouseWorking: true,
      childCount: 1,
      isSocsoSecondCategory: false,
      overrides: { pcb: 0 },
    });

    const epf = lookupEpfContributions(baseSalary);
    const socso = lookupSocsoContributions(baseSalary);
    const lindung = lookupLindung24Jam(baseSalary);
    const eis = roundMoney(Math.min(baseSalary, EIS_WAGE_CEILING) * EIS_RATE);

    expect(statutory.epfEmployee).toBe(epf.employee);
    expect(statutory.socsoEmployee).toBe(socso.employee);
    expect(statutory.lindung24Jam).toBe(lindung);
    expect(statutory.eisEmployee).toBe(eis);

    const summary = buildStaffPayrollSummary({ baseSalary, statutory });
    expect(summary.grossSalary).toBe(baseSalary);
    expect(summary.netSalary).toBe(
      roundMoney(
        baseSalary -
          statutory.epfEmployee -
          statutory.socsoEmployee -
          statutory.eisEmployee -
          statutory.lindung24Jam -
          statutory.pcb
      )
    );
  });

  it("netSalary identity: gross minus each employee statutory item", () => {
    const baseSalary = 4200;
    const statutory = calculateStatutoryDeductions({
      grossSalary: baseSalary,
      maritalStatus: "married",
      spouseWorking: false,
      childCount: 2,
      isSocsoSecondCategory: false,
      overrides: { pcb: 25.5 },
    });
    const summary = buildStaffPayrollSummary({ baseSalary, statutory });

    const rebuilt = roundMoney(
      summary.grossSalary -
        statutory.epfEmployee -
        statutory.socsoEmployee -
        statutory.eisEmployee -
        statutory.lindung24Jam -
        statutory.pcb
    );
    expect(summary.netSalary).toBe(rebuilt);
    expect(summary.grossSalary).toBe(summary.baseSalary);
  });
});
