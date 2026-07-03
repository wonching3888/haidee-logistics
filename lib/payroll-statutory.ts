import type { MaritalStatus } from "@/lib/constants/payroll";
import {
  EIS_RATE,
  EIS_WAGE_CEILING,
  EPF_EMPLOYEE_RATE,
  EPF_EMPLOYER_RATE,
} from "@/lib/constants/payroll";
import { lookupLindung24Jam } from "@/lib/constants/lindung-24-jam-brackets";
import { lookupSocsoContributions } from "@/lib/constants/socso-brackets";
import { lookupSocsoSecondCategoryEmployer } from "@/lib/constants/socso-second-category-brackets";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export interface StatutoryOverrides {
  epfEmployee?: number | null;
  epfEmployer?: number | null;
  socsoEmployee?: number | null;
  socsoEmployer?: number | null;
  lindung24Jam?: number | null;
  eisEmployee?: number | null;
  eisEmployer?: number | null;
  pcb?: number | null;
}

export interface StatutoryDeductions {
  epfEmployee: number;
  epfEmployer: number;
  socsoEmployee: number;
  socsoEmployer: number;
  lindung24Jam: number;
  eisEmployee: number;
  eisEmployer: number;
  pcb: number;
}

/** SKBBK (Lindung 24 jam) — official PERKESO bracket lookup, employee-borne. */
export function calculateLindung24Jam(grossSalary: number) {
  return lookupLindung24Jam(grossSalary);
}

/** EIS covers employees aged 18–60 only; 60+ (Second Category) exempt. */
export function isEisExempt(isSocsoSecondCategory?: boolean) {
  return Boolean(isSocsoSecondCategory);
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
  isSocsoSecondCategory?: boolean;
  overrides?: StatutoryOverrides;
}): StatutoryDeductions {
  const gross = Math.max(0, input.grossSalary);
  const eisExempt = isEisExempt(input.isSocsoSecondCategory);

  const epfEmployee =
    input.overrides?.epfEmployee ??
    roundMoney(gross * EPF_EMPLOYEE_RATE);
  const epfEmployer =
    input.overrides?.epfEmployer ??
    roundMoney(gross * EPF_EMPLOYER_RATE);

  const socsoBase = gross;
  let socsoEmployee: number;
  let socsoEmployer: number;
  if (input.isSocsoSecondCategory) {
    socsoEmployee = input.overrides?.socsoEmployee ?? 0;
    socsoEmployer =
      input.overrides?.socsoEmployer ??
      lookupSocsoSecondCategoryEmployer(socsoBase);
  } else {
    const socso = lookupSocsoContributions(socsoBase);
    socsoEmployee = input.overrides?.socsoEmployee ?? socso.employee;
    socsoEmployer = input.overrides?.socsoEmployer ?? socso.employer;
  }

  const lindung24Jam =
    input.overrides?.lindung24Jam ?? calculateLindung24Jam(gross);

  const eisBase = Math.min(gross, EIS_WAGE_CEILING);
  const eisEmployee =
    input.overrides?.eisEmployee ??
    (eisExempt ? 0 : roundMoney(eisBase * EIS_RATE));
  const eisEmployer =
    input.overrides?.eisEmployer ??
    (eisExempt ? 0 : roundMoney(eisBase * EIS_RATE));

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
    lindung24Jam,
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
  crateMultiMarketTotal: number;
  tripExtraAllowanceTotal: number;
  extraAllowanceTotal: number;
  advanceTotal: number;
}

export interface PayrollSummary {
  baseSalary: number;
  tripAllowanceTotal: number;
  charterSalaryTotal: number;
  crateCommissionTotal: number;
  crateMultiMarketTotal: number;
  extraAllowanceTotal: number;
  advanceTotal: number;
  grossSalary: number;
  statutory: StatutoryDeductions;
  netSalary: number;
}

/** UI/CSV display only — commission + multi-market bonus; gross calc unchanged. */
export function crateReturnEarningsDisplayTotal(input: {
  crateCommissionTotal: number;
  crateMultiMarketTotal: number;
}) {
  return roundMoney(
    input.crateCommissionTotal + input.crateMultiMarketTotal
  );
}

export function buildPayrollSummary(input: {
  earnings: PayrollSummaryInput;
  maritalStatus: MaritalStatus | null | undefined;
  childCount: number;
  isSocsoSecondCategory?: boolean;
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
      input.earnings.crateMultiMarketTotal +
      extraAllowanceTotal
  );

  const statutory = calculateStatutoryDeductions({
    grossSalary,
    maritalStatus: input.maritalStatus,
    childCount: input.childCount,
    isSocsoSecondCategory: input.isSocsoSecondCategory,
    overrides: input.overrides,
  });

  const netSalary = roundMoney(
    Math.max(
      0,
      grossSalary -
        statutory.epfEmployee -
        statutory.socsoEmployee -
        statutory.lindung24Jam -
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
    crateMultiMarketTotal: input.earnings.crateMultiMarketTotal,
    extraAllowanceTotal,
    advanceTotal: input.earnings.advanceTotal,
    grossSalary,
    statutory,
    netSalary,
  };
}
