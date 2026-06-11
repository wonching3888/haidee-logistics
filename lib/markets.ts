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
  KL: { bg: "#FEF08A", text: "#854D0E", border: "#854D0E", light: "#FEF08A" },
  BP: { bg: "#BBF7D0", text: "#14532D", border: "#14532D", light: "#BBF7D0" },
  MP: { bg: "#E9D5FF", text: "#581C87", border: "#581C87", light: "#E9D5FF" },
  SL: { bg: "#99F6E4", text: "#134E4A", border: "#134E4A", light: "#99F6E4" },
  MC: { bg: "#FED7AA", text: "#7C2D12", border: "#7C2D12", light: "#FED7AA" },
  A: { bg: "#E5E7EB", text: "#1F2937", border: "#1F2937", light: "#E5E7EB" },
  BM: { bg: "#BFDBFE", text: "#1E3A5F", border: "#1E3A5F", light: "#BFDBFE" },
  B: { bg: "#C7D2FE", text: "#312E81", border: "#312E81", light: "#C7D2FE" },
  P: { bg: "#A5F3FC", text: "#164E63", border: "#164E63", light: "#A5F3FC" },
  TP: { bg: "#E5E7EB", text: "#374151", border: "#374151", light: "#E5E7EB" },
  NT: { bg: "#E5E7EB", text: "#374151", border: "#374151", light: "#E5E7EB" },
  KD: { bg: "#FBCFE8", text: "#831843", border: "#831843", light: "#FBCFE8" },
  KT: { bg: "#FDE68A", text: "#78350F", border: "#78350F", light: "#FDE68A" },
  SA: { bg: "#BAE6FD", text: "#0C4A6E", border: "#0C4A6E", light: "#BAE6FD" },
  JB: { bg: "#FECDD3", text: "#881337", border: "#881337", light: "#FECDD3" },
};

/** KL子市场（货装KL车但目的地不同） */
export const KL_SUB_MARKETS = ["BP", "MP", "SL"] as const;

const DEFAULT_COLOR: MarketColorSet = {
  bg: "#E5E7EB",
  text: "#374151",
  border: "#374151",
  light: "#E5E7EB",
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
