import { getRouteGroupForMarket } from "@/lib/payroll-route-label";
import { sortMarkets } from "@/lib/markets";

/** Print order for Market D/O route-group sections (one D/O per group). */
export const MARKET_DO_PRINT_ORDER = [
  "KL",
  "MC",
  "BM",
  "A",
  "KD",
  "JB",
  "OTHER",
] as const;

export type MarketDORouteGroup = (typeof MARKET_DO_PRINT_ORDER)[number];

export function routeGroupPrintRank(
  routeGroup: string,
  printOrder: readonly string[] = MARKET_DO_PRINT_ORDER
): number {
  const idx = printOrder.indexOf(routeGroup);
  return idx === -1 ? printOrder.length : idx;
}

/** Earliest route group on MARKET_DO_PRINT_ORDER among the given market codes. */
export function getPrimaryRouteGroupForMarkets(
  marketCodes: string[],
  printOrder: readonly string[] = MARKET_DO_PRINT_ORDER
): string {
  let bestGroup = "OTHER";
  let bestRank = routeGroupPrintRank("OTHER", printOrder);

  for (const code of marketCodes) {
    const group = getRouteGroupForMarket(code);
    const rank = routeGroupPrintRank(group, printOrder);
    if (rank < bestRank) {
      bestRank = rank;
      bestGroup = group;
    }
  }

  return bestGroup;
}

export interface MarketDORowLike {
  area: string;
}

export interface MarketDOSectionPartition<T extends MarketDORowLike> {
  routeGroup: string;
  marketCodes: string[];
  rows: T[];
}

/** Minimum active crate columns before the whole print job uses A4 landscape. */
export const MARKET_DO_LANDSCAPE_COLUMN_THRESHOLD = 10;

export function partitionRowsByRouteGroup<T extends MarketDORowLike>(
  rows: T[],
  selectedMarketCodes: string[],
  printOrder: readonly string[] = MARKET_DO_PRINT_ORDER
): MarketDOSectionPartition<T>[] {
  const selected = new Set(
    selectedMarketCodes.map((code) => code.trim().toUpperCase()).filter(Boolean)
  );

  const byGroup = new Map<string, T[]>();
  for (const row of rows) {
    const area = row.area.trim().toUpperCase();
    if (!area || !selected.has(area)) continue;

    const routeGroup = getRouteGroupForMarket(area);
    const bucket = byGroup.get(routeGroup) ?? [];
    bucket.push(row);
    byGroup.set(routeGroup, bucket);
  }

  return printOrder
    .filter((routeGroup) => (byGroup.get(routeGroup)?.length ?? 0) > 0)
    .map((routeGroup) => {
      const groupRows = byGroup.get(routeGroup)!;
      const marketCodes = sortMarkets(
        Array.from(new Set(groupRows.map((row) => row.area.trim().toUpperCase())))
      );

      return {
        routeGroup,
        marketCodes,
        rows: groupRows,
      };
    });
}
