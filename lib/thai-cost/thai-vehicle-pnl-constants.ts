/**
 * Dedicated rates for Songkhla / Pattani Thai-vehicle PNL (THB only).
 * Independent of contractor monthly invoice, vehicle-trip P&L income rates, etc.
 */

export const THAI_VEHICLE_PNL_INCOME = {
  SONGKHLA: { crate: 50, box: 25 },
  PATTANI: { crate: 70, box: 35 },
} as const;

/** Handling fee inside Thai-vehicle PNL (not shared with contractor invoice helpers). */
export const THAI_VEHICLE_PNL_HANDLING = {
  SONGKHLA: { crate: 3, box: 2 },
  /** Contractor 20 + SAKRI 2.2 per crate; box 5. */
  PATTANI: { crate: 20 + 2.2, box: 5 },
} as const;

export const THAI_VEHICLE_PNL_DRIVER_TRIP_BUDGET = {
  SONGKHLA: 700,
  PATTANI: 1200,
} as const;

/** Monthly-worker allocation weights (crate:box). SK deliberately 1:1, not 3:2. */
export const THAI_VEHICLE_PNL_WORKER_WEIGHT = {
  SONGKHLA: { crate: 1, box: 1 },
  PATTANI: { crate: 4, box: 1 },
} as const;

/** Sentinel formal-driver name for substitute drivers (base wage 0). */
export const THAI_DRIVER_OTHER_NAME = "其他";

/** Notes prefix that marks a trip as rented (own-fleet cost replaced by rented trip_cost). */
export const THAI_VEHICLE_RENTED_NOTES_PREFIX = "RENTED:";

export const THAI_VEHICLE_PNL_DEFAULT_SONGKHLA_PLATE = "72-3869";
/** Display/default match for Songkhla prefill (master name is THONGDANG). */
export const THAI_VEHICLE_PNL_DEFAULT_SONGKHLA_DRIVER_NAME = "THONGDANG";
