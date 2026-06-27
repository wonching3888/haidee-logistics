import type { MaritalStatus } from "@/lib/constants/payroll";
import {
  EIS_RATE,
  EIS_WAGE_CEILING,
  EPF_EMPLOYEE_RATE,
  EPF_EMPLOYER_RATE,
} from "@/lib/constants/payroll";
import { lookupSocsoContributions } from "@/lib/constants/socso-brackets";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export interface StatutoryOverrides {
  epfEmployee?: number | null;
  epfEmployer?: number | null;
  socsoEmployee?: number | null;
  socsoEmployer?: number | null;
  eisEmployee?: number | null;
  eisEmployer?: number | null;
  pcb?: number | null;
}

export interface StatutoryDeductions {
  epfEmployee: number;
  epfEmployer: number;
  socsoEmployee: number;
  socsoEmployer: number;
  eisEmployee: number;
  eisEmployer: number;
  pcb: number;
}

/** Simplified monthly PCB based on chargeable income, marital status and children. */
export function calculatePcb(
  grossSalary: number,
  epfEmployee: number,
  maritalStatus: MaritalStatus | null | undefined,
  childCount: number
) {
  const personalRelief = 750;
  const spouseRelief = maritalStatus === "married" ? 333.33 : 0;
  const childRelief = Math.max(0, childCount) * 166.67;
  const chargeable = Math.max(
    0,
    grossSalary - epfEmployee - personalRelief - spouseRelief - childRelief
  );

  if (chargeable <= 3500) return 0;
  if (chargeable <= 5000) return roundMoney((chargeable - 3500) * 0.01);
  if (chargeable <= 7500) return roundMoney(15 + (chargeable - 5000) * 0.03);
  if (chargeable <= 10000) return roundMoney(90 + (chargeable - 7500) * 0.08);
  return roundMoney(290 + (chargeable - 10000) * 0.11);
}

export function calculateStatutoryDeductions(input: {
  grossSalary: number;
  maritalStatus: MaritalStatus | null | undefined;
  childCount: number;
  overrides?: StatutoryOverrides;
}): StatutoryDeductions {
  const gross = Math.max(0, input.grossSalary);

  const epfEmployee =
    input.overrides?.epfEmployee ??
    roundMoney(gross * EPF_EMPLOYEE_RATE);
  const epfEmployer =
    input.overrides?.epfEmployer ??
    roundMoney(gross * EPF_EMPLOYER_RATE);

  const socsoBase = gross;
  const socso = lookupSocsoContributions(socsoBase);
  const socsoEmployee = input.overrides?.socsoEmployee ?? socso.employee;
  const socsoEmployer = input.overrides?.socsoEmployer ?? socso.employer;

  const eisBase = Math.min(gross, EIS_WAGE_CEILING);
  const eisEmployee =
    input.overrides?.eisEmployee ?? roundMoney(eisBase * EIS_RATE);
  const eisEmployer =
    input.overrides?.eisEmployer ?? roundMoney(eisBase * EIS_RATE);

  const pcb =
    input.overrides?.pcb ??
    calculatePcb(
      gross,
      epfEmployee,
      input.maritalStatus,
      input.childCount
    );

  return {
    epfEmployee,
    epfEmployer,
    socsoEmployee,
    socsoEmployer,
    eisEmployee,
    eisEmployer,
    pcb,
  };
}

export interface PayrollSummaryInput {
  baseSalary: number;
  tripAllowanceTotal: number;
  charterSalaryTotal: number;
  crateCommissionTotal: number;
  tripExtraAllowanceTotal: number;
  extraAllowanceTotal: number;
  advanceTotal: number;
}

export interface PayrollSummary {
  baseSalary: number;
  tripAllowanceTotal: number;
  charterSalaryTotal: number;
  crateCommissionTotal: number;
  extraAllowanceTotal: number;
  advanceTotal: number;
  grossSalary: number;
  statutory: StatutoryDeductions;
  netSalary: number;
}

export function buildPayrollSummary(input: {
  earnings: PayrollSummaryInput;
  maritalStatus: MaritalStatus | null | undefined;
  childCount: number;
  overrides?: StatutoryOverrides;
}): PayrollSummary {
  const extraAllowanceTotal = roundMoney(
    input.earnings.extraAllowanceTotal + input.earnings.tripExtraAllowanceTotal
  );
  const grossSalary = roundMoney(
    input.earnings.baseSalary +
      input.earnings.tripAllowanceTotal +
      input.earnings.charterSalaryTotal +
      input.earnings.crateCommissionTotal +
      extraAllowanceTotal
  );

  const statutory = calculateStatutoryDeductions({
    grossSalary,
    maritalStatus: input.maritalStatus,
    childCount: input.childCount,
    overrides: input.overrides,
  });

  const netSalary = roundMoney(
    Math.max(
      0,
      grossSalary -
        statutory.epfEmployee -
        statutory.socsoEmployee -
        statutory.eisEmployee -
        statutory.pcb -
        input.earnings.advanceTotal
    )
  );

  return {
    baseSalary: input.earnings.baseSalary,
    tripAllowanceTotal: input.earnings.tripAllowanceTotal,
    charterSalaryTotal: input.earnings.charterSalaryTotal,
    crateCommissionTotal: input.earnings.crateCommissionTotal,
    extraAllowanceTotal,
    advanceTotal: input.earnings.advanceTotal,
    grossSalary,
    statutory,
    netSalary,
  };
}
