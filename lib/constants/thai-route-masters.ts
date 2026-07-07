/**
 * route_masters rows used for Thai-segment vehicle cost (mileage, toll, parking).
 * Distinct from MY payroll route allowances (KL/BM/A…).
 * No DB `region` column — these codes are stable and seeded explicitly.
 */
export const THAI_ROUTE_MASTER_CODES = ["SONGKHLA", "PATTANI"] as const;

export type ThaiRouteMasterCode = (typeof THAI_ROUTE_MASTER_CODES)[number];

export function isThaiRouteMasterCode(code: string): code is ThaiRouteMasterCode {
  return (THAI_ROUTE_MASTER_CODES as readonly string[]).includes(
    code.trim().toUpperCase()
  );
}

export function isMalaysiaPayrollRouteCode(code: string): boolean {
  return !isThaiRouteMasterCode(code);
}

/** Preset plates for Thai driver trip entry dropdown. */
export const THAI_DRIVER_TRIP_PLATE_OPTIONS = [
  "72-3353",
  "72-3338",
  "72-3869",
  "70-9522",
  "PKM 9389",
  "PKS 7679",
] as const;

export const THAI_DRIVER_TRIP_PLATE_OTHER = "Other" as const;
