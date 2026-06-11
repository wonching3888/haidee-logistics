import {
  getMarketDisplayName,
  MARKET_DISPLAY_NAMES,
} from "@/lib/constants/market-names";
import { MARKET_ORDER } from "@/lib/markets";

/** One print block per market, in standard market order. */
export const CRATE_TYPE_RECORD_BLOCKS: {
  title: string;
  codes: string[];
}[] = MARKET_ORDER.map((code) => ({
  title: getMarketDisplayName(code),
  codes: [code],
}));

export function getCrateTypeRecordBlockTitle(marketCode: string): string | null {
  return MARKET_DISPLAY_NAMES[marketCode] ?? null;
}
