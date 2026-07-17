import type { MaritalStatus } from "@/lib/constants/payroll";
import { EIS_RATE, EIS_WAGE_CEILING } from "@/lib/constants/payroll";
import { lookupEpfContributions } from "@/lib/constants/epf-brackets";
import { lookupLindung24Jam } from "@/lib/constants/lindung-24-jam-brackets";
import { lookupSocsoContributions } from "@/lib/constants/socso-brackets";
import { lookupSocsoSecondCategoryEmployer } from "@/lib/constants/socso-second-category-brackets";
import {
  emptyPcbYtd,
  resolvePayrollPcb,
} from "@/lib/pcb-policy";
import type { PcbYearToDate } from "@/lib/pcb-calculation";

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

export { calculatePcb, calculateMonthlyPcb } from "@/lib/pcb-calculation";
export type { MonthlyPcbInput, MonthlyPcbResult, PcbProfile } from "@/lib/pcb-calculation";

export function calculateStatutoryDeductions(input: {
  grossSalary: number;
  maritalStatus: MaritalStatus | null | undefined;
  spouseWorking?: boolean | null;
  childCount: number;
  /** Calendar year (required for auto PCB from 2026-07). */
  payrollYear?: number;
  payrollMonth?: number;
  /** YTD before this month (from driver_pcb_ytd_balances). */
  pcbYtdBeforeMonth?: PcbYearToDate;
  pcbLocked?: boolean;
  pcbFinal?: number | null;
  pcbMaritalDataVerified?: boolean;
  isSocsoSecondCategory?: boolean;
  overrides?: StatutoryOverrides;
}): StatutoryDeductions {
  const gross = Math.max(0, input.grossSalary);
  const eisExempt = isEisExempt(input.isSocsoSecondCategory);

  const epfTable = lookupEpfContributions(gross);
  const epfEmployee = input.overrides?.epfEmployee ?? epfTable.employee;
  // Company callers (buildPayrollSummary / buildStaffMonthPayrollSummary) always
  // resolve epfEmployer (override or flat 13%) before calling — this ?? table
  // branch is only for direct calculateStatutoryDeductions use / audits.
  const epfEmployer = input.overrides?.epfEmployer ?? epfTable.employer;

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

  /**
   * PCB: override > locked final > auto engine (from 2026-07) > 0.
   * Pre-July months stay override-only (June accounting unchanged).
   */
  const year = input.payrollYear ?? 0;
  const month = input.payrollMonth ?? 0;
  const pcb =
    year > 0 && month > 0
      ? resolvePayrollPcb({
          year,
          month,
          grossSalary: gross,
          epfEmployee,
          maritalStatus: input.maritalStatus,
          spouseWorking: input.spouseWorking,
          childCount: input.childCount,
          ytdBeforeMonth: input.pcbYtdBeforeMonth ?? emptyPcbYtd(),
          pcbOverride: input.overrides?.pcb,
          pcbLocked: input.pcbLocked,
          pcbFinal: input.pcbFinal,
        }).pcb
      : (input.overrides?.pcb ?? 0);

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
  spouseWorking?: boolean | null;
  childCount: number;
  payrollYear?: number;
  payrollMonth?: number;
  pcbYtdBeforeMonth?: PcbYearToDate;
  pcbLocked?: boolean;
  pcbFinal?: number | null;
  pcbMaritalDataVerified?: boolean;
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

  /**
   * Company policy (2026-07): employer EPF defaults to a flat 13% of gross
   * salary when the month has no explicit epfEmployerOverride, instead of
   * the official Third Schedule bracket table. Per-month override still
   * wins when set. Nothing else here changes.
   */
  const epfEmployerDefault = roundMoney(grossSalary * 0.13);
  const resolvedOverrides: StatutoryOverrides = {
    ...input.overrides,
    epfEmployer: input.overrides?.epfEmployer ?? epfEmployerDefault,
  };

  const statutory = calculateStatutoryDeductions({
    grossSalary,
    maritalStatus: input.maritalStatus,
    spouseWorking: input.spouseWorking,
    childCount: input.childCount,
    payrollYear: input.payrollYear,
    payrollMonth: input.payrollMonth,
    pcbYtdBeforeMonth: input.pcbYtdBeforeMonth,
    pcbLocked: input.pcbLocked,
    pcbFinal: input.pcbFinal,
    pcbMaritalDataVerified: input.pcbMaritalDataVerified,
    isSocsoSecondCategory: input.isSocsoSecondCategory,
    overrides: resolvedOverrides,
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
