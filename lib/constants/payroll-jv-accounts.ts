/** Shared AutoCount JV accounts (same for every driver). */
export const SHARED_PAYROLL_JV_ACCOUNTS = {
  epfPayable: "4101-0000",
  /** SOCSO + EIS + Lindung 24 jam (SKBBK) employee remittance to PERKESO. */
  socsoEisPayable: "4102-0000",
  pcbPayable: "4103-0000",
} as const;

const DRIVER_JV_ACCOUNT_PREFIXES = {
  baseSalary: "6308",
  wages: "6307",
  epfEmployer: "9005",
  socsoEisEmployer: "9006",
  advance: "3301",
  netPayable: "4104",
} as const;

export interface DriverJvAccountCodes {
  baseSalary: string;
  wages: string;
  epfEmployer: string;
  socsoEisEmployer: string;
  advance: string;
  netPayable: string;
  epfPayable: string;
  socsoEisPayable: string;
  pcbPayable: string;
}

function driverAccountCode(prefix: string, suffix: string) {
  return `${prefix}-${suffix}`;
}

/**
 * Build per-driver JV account codes from the driver's account code suffix.
 * Shared payable accounts (4101/4102/4103-0000) are appended for every driver.
 */
export function buildDriverJvAccountCodes(input: {
  accountCodeSuffix: string;
}): DriverJvAccountCodes {
  const suffix = input.accountCodeSuffix.trim().toUpperCase();
  if (!suffix) {
    throw new Error("司机科目后缀不能为空 Driver account code suffix is required");
  }

  return {
    baseSalary: driverAccountCode(DRIVER_JV_ACCOUNT_PREFIXES.baseSalary, suffix),
    wages: driverAccountCode(DRIVER_JV_ACCOUNT_PREFIXES.wages, suffix),
    epfEmployer: driverAccountCode(DRIVER_JV_ACCOUNT_PREFIXES.epfEmployer, suffix),
    socsoEisEmployer: driverAccountCode(
      DRIVER_JV_ACCOUNT_PREFIXES.socsoEisEmployer,
      suffix
    ),
    advance: driverAccountCode(DRIVER_JV_ACCOUNT_PREFIXES.advance, suffix),
    netPayable: driverAccountCode(DRIVER_JV_ACCOUNT_PREFIXES.netPayable, suffix),
    epfPayable: SHARED_PAYROLL_JV_ACCOUNTS.epfPayable,
    socsoEisPayable: SHARED_PAYROLL_JV_ACCOUNTS.socsoEisPayable,
    pcbPayable: SHARED_PAYROLL_JV_ACCOUNTS.pcbPayable,
  };
}
