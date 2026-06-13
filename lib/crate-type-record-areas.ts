import {
  getMarketDisplayName,
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
  if (!(MARKET_ORDER as readonly string[]).includes(marketCode)) {
    return null;
  }
  return getMarketDisplayName(marketCode);
}
