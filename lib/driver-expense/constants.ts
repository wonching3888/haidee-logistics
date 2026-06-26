import { KL_SUB_MARKETS } from "@/lib/markets";

export const LARGE_CRATE_CODES = new Set(["VIO", "BS"]);

/** Markets that share KL per-crate unload rules and KL rate config (KL 搬车子市场). */
export const KL_UNLOAD_FEE_MARKETS = new Set<string>(["KL", ...KL_SUB_MARKETS]);

export function resolveUnloadingRateConfigMarket(market: string): string {
  const code = market.trim().toUpperCase();
  if (KL_UNLOAD_FEE_MARKETS.has(code) && code !== "KL") {
    return "KL";
  }
  return code;
}

export function usesKlUnloadFeeRules(market: string): boolean {
  return KL_UNLOAD_FEE_MARKETS.has(market.trim().toUpperCase());
}
export const PER_TRIP_UNLOAD_MARKETS = new Set(["TP", "KT", "P", "SA", "NT"]);

export const KL_KPB_STORE_PATTERN = /^[A-H]\d+$/i;

export const ZERO_UNLOAD_MARKETS = new Set(["JB"]);

/** Markets that no longer charge KPB (unload unchanged; use rate 0 + calc short-circuit, not isKpbExempt). */
export const KPB_DISABLED_MARKETS = new Set(["BM", "KD"]);

export function isKpbDisabledMarket(market: string): boolean {
  return KPB_DISABLED_MARKETS.has(market.trim().toUpperCase());
}

export type TruckSize = "small" | "large";

export function resolveTruckSize(truckType: string | null | undefined): TruckSize {
  const normalized = (truckType ?? "").trim().toLowerCase();
  if (normalized === "small" || normalized === "kecil") return "small";
  return "large";
}

export function truckSizeLabel(size: TruckSize) {
  return size === "small" ? "小车 Small" : "大车 Large";
}
