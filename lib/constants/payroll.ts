export const MARITAL_STATUSES = [
  { value: "single", label: "未婚 Single" },
  { value: "married", label: "已婚 Married" },
] as const;

export type MaritalStatus = (typeof MARITAL_STATUSES)[number]["value"];

export const PAYROLL_EXTRA_TYPES = [
  { value: "extra_allowance", label: "额外津贴 Extra Allowance" },
  { value: "advance", label: "借支 Advance" },
] as const;

export type PayrollExtraType = (typeof PAYROLL_EXTRA_TYPES)[number]["value"];

export const EPF_EMPLOYEE_RATE = 0.11;
export const EPF_EMPLOYER_RATE = 0.13;
export const EIS_RATE = 0.002;
export const SOCSO_WAGE_CEILING = 6000;
export const EIS_WAGE_CEILING = 6000;

export function isMaritalStatus(value: string): value is MaritalStatus {
  return MARITAL_STATUSES.some((item) => item.value === value);
}

export function isPayrollExtraType(value: string): value is PayrollExtraType {
  return PAYROLL_EXTRA_TYPES.some((item) => item.value === value);
}

export function tripAllowanceForMarketCount(
  marketCount: number,
  rates: {
    allowance1Market: number | null;
    allowance2Markets: number | null;
    allowance3Markets: number | null;
  }
) {
  if (marketCount <= 0) return 0;
  if (marketCount === 1) return rates.allowance1Market ?? 0;
  if (marketCount === 2) return rates.allowance2Markets ?? 0;
  return rates.allowance3Markets ?? 0;
}

export function crateCommissionForTruckType(
  truckType: string | null | undefined,
  rates: {
    bigTruckCrateCommission: number | null;
    smallTruckCrateCommission: number | null;
  }
) {
  if (truckType === "small") return rates.smallTruckCrateCommission ?? 0;
  return rates.bigTruckCrateCommission ?? 0;
}
