export const DEFAULT_EXTRA_MARKET_ALLOWANCE = 30;

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
