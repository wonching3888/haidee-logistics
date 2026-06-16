export const LARGE_CRATE_CODES = new Set(["VIO", "BS"]);

export const PER_TRIP_UNLOAD_MARKETS = new Set(["TP", "KT", "P", "SA", "NT"]);

export const KL_KPB_STORE_PATTERN = /^[A-H]\d+$/i;

export const ZERO_UNLOAD_MARKETS = new Set(["JB"]);

export type TruckSize = "small" | "large";

export function resolveTruckSize(truckType: string | null | undefined): TruckSize {
  const normalized = (truckType ?? "").trim().toLowerCase();
  if (normalized === "small" || normalized === "kecil") return "small";
  return "large";
}

export function truckSizeLabel(size: TruckSize) {
  return size === "small" ? "小车 Small" : "大车 Large";
}
