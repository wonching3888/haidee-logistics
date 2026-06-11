export interface DepotGroup {
  label: string;
  markets: readonly string[];
}

export const DEPOT_GROUPS: readonly DepotGroup[] = [
  { label: "KL", markets: ["KL", "BP", "MP", "SL"] },
  { label: "MC", markets: ["MC"] },
  { label: "A", markets: ["A"] },
  { label: "BM", markets: ["BM"] },
  { label: "TP/P/NT", markets: ["P", "TP", "NT", "KT", "SA"] },
  { label: "KD", markets: ["KD"] },
  { label: "OTHERS", markets: ["JB"] },
] as const;

const marketToDepotMap = new Map<string, string>(
  DEPOT_GROUPS.flatMap((group) =>
    group.markets.map((market) => [market, group.label])
  )
);

export function marketToDepotLabel(marketCode: string): string {
  return marketToDepotMap.get(marketCode) ?? "OTHERS";
}

export function emptyDepotQty(): Record<string, { crate: number; box: number }> {
  const qty: Record<string, { crate: number; box: number }> = {};
  for (const group of DEPOT_GROUPS) {
    qty[group.label] = { crate: 0, box: 0 };
  }
  return qty;
}
