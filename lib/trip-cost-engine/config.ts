export const TRIP_COST_MODES = ["legacy", "shadow", "enforced"] as const;

export type TripCostMode = (typeof TRIP_COST_MODES)[number];

function parseTripCostMode(
  raw: string | undefined,
  fallback: TripCostMode = "legacy"
): TripCostMode {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "legacy" || normalized === "shadow" || normalized === "enforced") {
    return normalized;
  }
  return fallback;
}

export interface TripCostEngineConfig {
  voucherCostMode: TripCostMode;
  vehicleAllocMode: TripCostMode;
}

let cachedConfig: TripCostEngineConfig = {
  voucherCostMode: parseTripCostMode(process.env.VOUCHER_COST_MODE),
  vehicleAllocMode: parseTripCostMode(process.env.VEHICLE_ALLOC_MODE),
};

/** Resolved once at module load; use reload for tests. */
export function getTripCostEngineConfig(): Readonly<TripCostEngineConfig> {
  return cachedConfig;
}

export function getVoucherCostMode(): TripCostMode {
  return cachedConfig.voucherCostMode;
}

/** Step 3+: new save/transition cost path (market_actuals apply on confirm). */
export function isVoucherCostEnforced(): boolean {
  return cachedConfig.voucherCostMode === "enforced";
}

/** Legacy save-time proportional writeback to unloading_fees overrides. */
export function shouldWritebackVoucherActualsOnSave(): boolean {
  return cachedConfig.voucherCostMode !== "enforced";
}

export function getVehicleAllocMode(): TripCostMode {
  return cachedConfig.vehicleAllocMode;
}

/** Shadow: dual-compute legacy+next, log diffs; production output stays legacy. */
export function isVehicleAllocShadow(): boolean {
  return cachedConfig.vehicleAllocMode === "shadow";
}

export function isVehicleAllocEnforced(): boolean {
  return cachedConfig.vehicleAllocMode === "enforced";
}

/** Until enforced, all report/API output uses legacy path. */
export function shouldUseLegacyTripCostOutput(): boolean {
  return cachedConfig.vehicleAllocMode !== "enforced";
}

/** Re-read env (or overrides). Intended for unit tests. */
export function reloadTripCostEngineConfig(
  env: Partial<Record<"VOUCHER_COST_MODE" | "VEHICLE_ALLOC_MODE", string>> = {}
): TripCostEngineConfig {
  cachedConfig = {
    voucherCostMode: parseTripCostMode(
      env.VOUCHER_COST_MODE ?? process.env.VOUCHER_COST_MODE
    ),
    vehicleAllocMode: parseTripCostMode(
      env.VEHICLE_ALLOC_MODE ?? process.env.VEHICLE_ALLOC_MODE
    ),
  };
  return cachedConfig;
}
