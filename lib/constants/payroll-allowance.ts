export const DEFAULT_EXTRA_MARKET_ALLOWANCE = 30;
export const DEFAULT_CRATE_RETURN_MULTI_MARKET_ALLOWANCE = 30;
export const DEFAULT_BP_CRATE_COMMISSION_BIG_TRUCK = 210;
export const DEFAULT_BP_CRATE_COMMISSION_SMALL_TRUCK = 190;

export const PAYROLL_ROUTE_CODES = [
  "KL",
  "BM",
  "A",
  "MC",
  "KD",
  "JB",
  "OTHER",
] as const;

export type PayrollRouteCode = (typeof PAYROLL_ROUTE_CODES)[number];
