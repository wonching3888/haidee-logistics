import { CRATE_RENTAL_TYPE_ORDER } from "@/lib/constants/crate-rental-rates";
import { DISPATCH_MARKET_ORDER, isOtherMarket } from "@/lib/markets";

export const UNLOAD_CRATE_TYPES = [...CRATE_RENTAL_TYPE_ORDER] as const;

export type UnloadCrateType = (typeof UNLOAD_CRATE_TYPES)[number];

export const UNLOAD_MARKET_CODES = DISPATCH_MARKET_ORDER.filter(
  (code) => !isOtherMarket(code)
);

export function unloadRateKey(marketCode: string, crateType: string) {
  return `${marketCode}:${crateType}`;
}

export function sortUnloadRates<
  T extends { marketCode: string; crateType: string },
>(rows: T[]) {
  const marketOrder = new Map<string, number>(
    UNLOAD_MARKET_CODES.map((code, index) => [code, index])
  );
  const crateOrder = new Map<string, number>(
    UNLOAD_CRATE_TYPES.map((code, index) => [code, index])
  );

  return [...rows].sort((a, b) => {
    const marketDiff =
      (marketOrder.get(a.marketCode) ?? 999) -
      (marketOrder.get(b.marketCode) ?? 999);
    if (marketDiff !== 0) return marketDiff;
    return (
      (crateOrder.get(a.crateType as UnloadCrateType) ?? 999) -
      (crateOrder.get(b.crateType as UnloadCrateType) ?? 999)
    );
  });
}
