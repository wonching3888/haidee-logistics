/** Display markets shown on voucher UI ↔ `unloading_fees.market` row codes. */

export const KL_DISPLAY_GROUP = ["KL", "BP", "MP", "SL"] as const;

/** BM Pindah virtual row ↔ per-trip unload markets (see `PER_TRIP_UNLOAD_MARKETS`). */
export const BM_PINDAH_DISPLAY_GROUP = ["P", "TP", "KT", "NT", "SA"] as const;

export type DisplayMarket =
  | "KL"
  | "BM"
  | "A"
  | "KD"
  | "MC"
  | "BM Pindah"
  | (string & {});

/**
 * Fee-row market codes that belong to a display market.
 * Direct markets map 1:1; merged groups list all contributing row markets.
 */
export function feeMarketsForDisplayMarket(displayMarket: string): readonly string[] {
  const normalized = displayMarket.trim();
  if (normalized === "KL") return KL_DISPLAY_GROUP;
  if (normalized === "BM Pindah") return BM_PINDAH_DISPLAY_GROUP;
  return [normalized];
}

/**
 * Primary fee row for a display market on this trip (first candidate present).
 * Merged groups (KL, BM Pindah) store the full display amount on this row;
 * sibling rows in the group receive override `0` so P&L sums stay correct.
 */
export function primaryFeeMarketForDisplay(
  displayMarket: string,
  presentFeeMarkets: readonly string[]
): string | null {
  const present = new Set(presentFeeMarkets);
  for (const market of feeMarketsForDisplayMarket(displayMarket)) {
    if (present.has(market)) return market;
  }
  return null;
}
