import type { MaritalStatus } from "@/lib/constants/payroll";
import { decimalToNumber } from "@/lib/freight-rates";
import type { PcbYearToDate } from "@/lib/pcb-calculation";
import { emptyPcbYtd } from "@/lib/pcb-policy";
import {
  calculateStatutoryDeductions,
  type StatutoryOverrides,
} from "@/lib/payroll-statutory";
import { buildStaffPayrollSummary } from "@/lib/staff-payroll-statutory";

export function staffStatutoryOverridesFromMonth(
  month: {
    epfEmployeeOverride?: unknown;
    epfEmployerOverride?: unknown;
    socsoEmployeeOverride?: unknown;
    socsoEmployerOverride?: unknown;
    lindung24JamOverride?: unknown;
    eisEmployeeOverride?: unknown;
    eisEmployerOverride?: unknown;
    pcbOverride?: unknown;
  } | null | undefined,
  lindung24JamOptOut: boolean
): StatutoryOverrides {
  const lindungFromMonth = decimalToNumber(month?.lindung24JamOverride);
  return {
    epfEmployee: decimalToNumber(month?.epfEmployeeOverride),
    epfEmployer: decimalToNumber(month?.epfEmployerOverride),
    socsoEmployee: decimalToNumber(month?.socsoEmployeeOverride),
    socsoEmployer: decimalToNumber(month?.socsoEmployerOverride),
    lindung24Jam:
      lindungFromMonth != null
        ? lindungFromMonth
        : lindung24JamOptOut
          ? 0
          : null,
    eisEmployee: decimalToNumber(month?.eisEmployeeOverride),
    eisEmployer: decimalToNumber(month?.eisEmployerOverride),
    pcb: decimalToNumber(month?.pcbOverride),
  };
}

export function buildStaffMonthPayrollSummary(input: {
  baseSalary: number | null;
  maritalStatus: MaritalStatus | null;
  spouseWorking?: boolean | null;
  childCount: number;
  isSocsoSecondCategory?: boolean;
  lindung24JamOptOut?: boolean;
  year: number;
  month: number;
  pcbYtdBeforeMonth?: PcbYearToDate;
  pcbLocked?: boolean;
  pcbFinal?: number | null;
  monthOverrides?: {
    epfEmployeeOverride?: unknown;
    epfEmployerOverride?: unknown;
    socsoEmployeeOverride?: unknown;
    socsoEmployerOverride?: unknown;
    lindung24JamOverride?: unknown;
    eisEmployeeOverride?: unknown;
    eisEmployerOverride?: unknown;
    pcbOverride?: unknown;
  } | null;
}) {
  const baseSalary = input.baseSalary ?? 0;
  const overrides = staffStatutoryOverridesFromMonth(
    input.monthOverrides,
    Boolean(input.lindung24JamOptOut)
  );
  const statutory = calculateStatutoryDeductions({
    grossSalary: baseSalary,
    maritalStatus: input.maritalStatus,
    spouseWorking: input.spouseWorking,
    childCount: input.childCount,
    isSocsoSecondCategory: input.isSocsoSecondCategory,
    payrollYear: input.year,
    payrollMonth: input.month,
    pcbYtdBeforeMonth: input.pcbYtdBeforeMonth ?? emptyPcbYtd(),
    pcbLocked: input.pcbLocked,
    pcbFinal: input.pcbFinal,
    overrides,
  });
  return buildStaffPayrollSummary({ baseSalary, statutory });
}
