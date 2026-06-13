import {
  MARKET_ORDER,
  DISPATCH_MARKET_ORDER,
  MARKET_COLORS,
  KL_SUB_MARKETS,
  OTHER_MARKET_CODE,
  MARKETS_WITHOUT_FREIGHT,
  getMarketBg,
  getMarketColor,
  getStallDisplayLabel,
  isOtherMarket,
  sortMarkets,
  filterOrderedMarkets,
  getActiveMarkets,
} from "@/lib/markets";

export {
  MARKET_ORDER,
  DISPATCH_MARKET_ORDER,
  MARKET_COLORS,
  KL_SUB_MARKETS,
  OTHER_MARKET_CODE,
  MARKETS_WITHOUT_FREIGHT,
  getMarketBg,
  getMarketColor,
  getStallDisplayLabel,
  isOtherMarket,
  sortMarkets,
  filterOrderedMarkets,
  getActiveMarkets,
};

export const MARKET_CODES = [...MARKET_ORDER] as const;
export type MarketCode = (typeof MARKET_CODES)[number];

/** @deprecated Use getMarketBg() — kept for simple bg string lookups */
export const MARKET_COLORS_SIMPLE: Record<string, string> = Object.fromEntries(
  MARKET_ORDER.map((code) => [code, getMarketBg(code)])
);
