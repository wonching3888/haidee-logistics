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

export function getVehicleAllocMode(): TripCostMode {
  return cachedConfig.vehicleAllocMode;
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
