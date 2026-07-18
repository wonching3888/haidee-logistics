import { SHARED_PAYROLL_JV_ACCOUNTS } from "@/lib/constants/payroll-jv-accounts";

const STAFF_JV_ACCOUNT_PREFIXES = {
  baseSalary: "9000", // payrollCategory === "salary"
  baseSalaryDirector: "9003", // payrollCategory === "director_remuneration"
  epfEmployer: "9005",
  socsoEisEmployer: "9006",
  /** Pending confirmation — same prefix as drivers for now. */
  netPayable: "4104",
} as const;

export interface StaffJvAccountCodes {
  baseSalary: string;
  epfEmployer: string;
  socsoEisEmployer: string;
  netPayable: string;
  epfPayable: string;
  socsoEisPayable: string;
  pcbPayable: string;
}

function staffAccountCode(prefix: string, suffix: string) {
  return `${prefix}-${suffix}`;
}

/**
 * Build per-staff JV account codes from payrollCategory + accountCodeSuffix.
 * Shared payable accounts (4101/4102/4103-0000) are company-wide.
 */
export function buildStaffJvAccountCodes(input: {
  accountCodeSuffix: string;
  payrollCategory: string;
}): StaffJvAccountCodes {
  const suffix = input.accountCodeSuffix.trim().toUpperCase();
  if (!suffix) {
    throw new Error("员工科目后缀不能为空 Staff account code suffix is required");
  }

  const basePrefix =
    input.payrollCategory === "director_remuneration"
      ? STAFF_JV_ACCOUNT_PREFIXES.baseSalaryDirector
      : STAFF_JV_ACCOUNT_PREFIXES.baseSalary;

  return {
    baseSalary: staffAccountCode(basePrefix, suffix),
    epfEmployer: staffAccountCode(STAFF_JV_ACCOUNT_PREFIXES.epfEmployer, suffix),
    socsoEisEmployer: staffAccountCode(
      STAFF_JV_ACCOUNT_PREFIXES.socsoEisEmployer,
      suffix
    ),
    netPayable: staffAccountCode(STAFF_JV_ACCOUNT_PREFIXES.netPayable, suffix),
    epfPayable: SHARED_PAYROLL_JV_ACCOUNTS.epfPayable,
    socsoEisPayable: SHARED_PAYROLL_JV_ACCOUNTS.socsoEisPayable,
    pcbPayable: SHARED_PAYROLL_JV_ACCOUNTS.pcbPayable,
  };
}

export { STAFF_JV_ACCOUNT_PREFIXES };
