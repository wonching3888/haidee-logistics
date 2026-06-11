export const MARKET_ORDER = [
  "KL",
  "BP",
  "MP",
  "SL",
  "MC",
  "A",
  "BM",
  "P",
  "TP",
  "NT",
  "KD",
  "KT",
  "SA",
  "JB",
] as const;

/** Primary columns for dispatch matrix & daily summary */
export const DISPATCH_MARKET_ORDER = [...MARKET_ORDER] as const;

export type MarketCode = (typeof MARKET_ORDER)[number];

export interface MarketColorSet {
  bg: string;
  text: string;
  border: string;
  light: string;
}

export const MARKET_COLORS: Record<string, MarketColorSet> = {
  KL: { bg: "#FFD700", text: "#7B6000", border: "#F0C000", light: "#FFFDE7" },
  SL: { bg: "#FFD700", text: "#7B6000", border: "#F0C000", light: "#FFFDE7" },
  BP: { bg: "#7BC67E", text: "#1B5E20", border: "#5CAF63", light: "#E8F5E9" },
  MP: { bg: "#7BC67E", text: "#1B5E20", border: "#5CAF63", light: "#E8F5E9" },
  JB: { bg: "#7BC67E", text: "#1B5E20", border: "#5CAF63", light: "#E8F5E9" },
  BM: { bg: "#64B5F6", text: "#0D47A1", border: "#42A5F5", light: "#E3F2FD" },
  A: { bg: "#F5F5F5", text: "#424242", border: "#BDBDBD", light: "#FAFAFA" },
  TP: { bg: "#F5F5F5", text: "#424242", border: "#BDBDBD", light: "#FAFAFA" },
  KT: { bg: "#F5F5F5", text: "#424242", border: "#BDBDBD", light: "#FAFAFA" },
  NT: { bg: "#F5F5F5", text: "#424242", border: "#BDBDBD", light: "#FAFAFA" },
  SA: { bg: "#F5F5F5", text: "#424242", border: "#BDBDBD", light: "#FAFAFA" },
  KD: { bg: "#F48FB1", text: "#880E4F", border: "#F06292", light: "#FCE4EC" },
  MC: { bg: "#FFB74D", text: "#E65100", border: "#FFA726", light: "#FFF3E0" },
  B: { bg: "#CE93D8", text: "#4A148C", border: "#BA68C8", light: "#F3E5F5" },
  P: { bg: "#80DEEA", text: "#006064", border: "#4DD0E1", light: "#E0F7FA" },
};

/** KL子市场（货装KL车但目的地不同） */
export const KL_SUB_MARKETS = ["BP", "MP", "SL"] as const;

const DEFAULT_COLOR: MarketColorSet = {
  bg: "#5A6680",
  text: "#FFFFFF",
  border: "#5A6680",
  light: "#F5F7FA",
};

export function getMarketColor(code: string): MarketColorSet {
  return MARKET_COLORS[code] ?? DEFAULT_COLOR;
}

export function getMarketBg(code: string): string {
  return getMarketColor(code).bg;
}

export function sortMarkets(
  codes: string[],
  order: readonly string[] = MARKET_ORDER
): string[] {
  const rank = new Map(order.map((c, i) => [c, i]));
  return [...codes].sort(
    (a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999)
  );
}

export function filterOrderedMarkets(
  codes: Iterable<string>,
  order: readonly string[] = MARKET_ORDER
): string[] {
  const set = new Set(codes);
  return order.filter((c) => set.has(c));
}

export function getActiveMarkets(
  colTotals: Record<string, number>,
  order: readonly string[] = DISPATCH_MARKET_ORDER
): string[] {
  const withData = order.filter((c) => (colTotals[c] ?? 0) > 0);
  return withData.length > 0 ? [...withData] : [...order];
}
