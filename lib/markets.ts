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
  KL: { bg: "#FDE047", text: "#713F12", border: "#713F12", light: "#FDE047" },
  SL: { bg: "#FDE047", text: "#713F12", border: "#713F12", light: "#FDE047" },
  BP: { bg: "#86EFAC", text: "#14532D", border: "#14532D", light: "#86EFAC" },
  MP: { bg: "#86EFAC", text: "#14532D", border: "#14532D", light: "#86EFAC" },
  JB: { bg: "#86EFAC", text: "#14532D", border: "#14532D", light: "#86EFAC" },
  BM: { bg: "#7DD3FC", text: "#0C4A6E", border: "#0C4A6E", light: "#7DD3FC" },
  KD: { bg: "#FDA4AF", text: "#881337", border: "#881337", light: "#FDA4AF" },
  MC: { bg: "#FDB97D", text: "#7C2D12", border: "#7C2D12", light: "#FDB97D" },
  A: { bg: "#F3F4F6", text: "#1F2937", border: "#1F2937", light: "#F3F4F6" },
  TP: { bg: "#F3F4F6", text: "#1F2937", border: "#1F2937", light: "#F3F4F6" },
  KT: { bg: "#F3F4F6", text: "#1F2937", border: "#1F2937", light: "#F3F4F6" },
  NT: { bg: "#F3F4F6", text: "#1F2937", border: "#1F2937", light: "#F3F4F6" },
  P: { bg: "#F3F4F6", text: "#1F2937", border: "#1F2937", light: "#F3F4F6" },
  SA: { bg: "#F3F4F6", text: "#1F2937", border: "#1F2937", light: "#F3F4F6" },
  B: { bg: "#F3F4F6", text: "#1F2937", border: "#1F2937", light: "#F3F4F6" },
};

/** KL子市场（货装KL车但目的地不同） */
export const KL_SUB_MARKETS = ["BP", "MP", "SL"] as const;

const DEFAULT_COLOR: MarketColorSet = {
  bg: "#F3F4F6",
  text: "#1F2937",
  border: "#1F2937",
  light: "#F3F4F6",
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
