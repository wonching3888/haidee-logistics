import type { PnlTripRow, PnlTripTotals } from "@/lib/pnl-report-types";
import { getTripCostEngineConfig } from "@/lib/trip-cost-engine/config";

const CACHE_TTL_MS = 5 * 60 * 1000;

export interface PnlMonthTripsCacheEntry {
  expiresAt: number;
  drivers: string[];
  trips: PnlTripRow[];
  tripTotals: PnlTripTotals;
}

const cache = new Map<string, PnlMonthTripsCacheEntry>();
const inflight = new Map<string, Promise<PnlMonthTripsCacheEntry>>();

export function pnlMonthTripsCacheKey(input: {
  year: number;
  month: number;
  day?: string | null;
  routeFilter?: string;
  driverFilter?: string;
}) {
  const { voucherCostMode, vehicleAllocMode } = getTripCostEngineConfig();
  return `${input.year}-${input.month}|${input.day ?? "full"}|${input.routeFilter ?? "ALL"}|${input.driverFilter ?? "ALL"}|voucher:${voucherCostMode}|vehicle:${vehicleAllocMode}`;
}

export function getCachedPnlMonthTrips(
  key: string
): PnlMonthTripsCacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry;
}

export function setCachedPnlMonthTrips(
  key: string,
  value: Omit<PnlMonthTripsCacheEntry, "expiresAt">
) {
  cache.set(key, { ...value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function getInflightPnlMonthTrips(key: string) {
  return inflight.get(key);
}

export function setInflightPnlMonthTrips(
  key: string,
  promise: Promise<PnlMonthTripsCacheEntry>
) {
  inflight.set(key, promise);
  void promise.finally(() => {
    if (inflight.get(key) === promise) {
      inflight.delete(key);
    }
  });
}

/** Test helper */
export function clearPnlMonthTripsCache() {
  cache.clear();
  inflight.clear();
}
