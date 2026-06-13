/** Full display names for market / area codes (one name per market). */
export const MARKET_DISPLAY_NAMES: Record<string, string> = {
  KL: "SELAYANG",
  BP: "BATU PAHAT",
  MP: "MUAR",
  SL: "SEREMBAN",
  MC: "MELAKA",
  A: "IPOH",
  BM: "BUKIT MERTAJAM",
  P: "PENANG",
  TP: "TAIPING",
  NT: "NIBONG TEBAL",
  KT: "TANJUNG PIANDANG",
  SA: "SIMPANG AMPAT",
  KD: "KEDAH",
  JB: "JOHOR BAHRU",
};

export function getMarketDisplayName(marketCode: string): string {
  return MARKET_DISPLAY_NAMES[marketCode] ?? marketCode.toUpperCase();
}
