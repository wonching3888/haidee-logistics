import { getMarketDisplayName } from "@/lib/constants/market-names";

/** Thailand transit hub label for WTL dual-segment TH rows (no SST, no tax code). */
export const INVOICE_TH_SEGMENT_ROUTE_LABEL = "THAILAND TO BKT KAYU HITAM";

export const INVOICE_ROUTE_PREFIX = "BKT KAYU HITAM TO ";

/** Invoice MY-segment markets in display order. */
export const INVOICE_ROUTE_MARKET_CODES = [
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
  "KT",
  "SA",
  "KD",
  "JB",
] as const;

export type InvoiceRouteMarketCode = (typeof INVOICE_ROUTE_MARKET_CODES)[number];

/**
 * Invoice route short names (colloquial labels for Tax Invoice MY rows).
 * Independent from markets.name master data.
 */
export const INVOICE_MARKET_SHORT_NAMES: Record<InvoiceRouteMarketCode, string> =
  {
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

export function getInvoiceMarketShortName(marketCode: string): string {
  const shortName =
    INVOICE_MARKET_SHORT_NAMES[marketCode as InvoiceRouteMarketCode];
  return shortName ?? marketCode.toUpperCase();
}

export function getInvoiceRouteLabel(marketCode: string): string {
  return `${INVOICE_ROUTE_PREFIX}${getInvoiceMarketShortName(marketCode)}`;
}

/** Mode 1a accounting invoice: SADAO hub → actual destination place name. */
export const MODE1A_INVOICE_ROUTE_PREFIX = "SADAO TO ";

export function getMode1aInvoiceRouteLabel(marketCode: string): string {
  return `${MODE1A_INVOICE_ROUTE_PREFIX}${getMarketDisplayName(marketCode)}`;
}

export function buildAllInvoiceRouteLabels(): Record<
  InvoiceRouteMarketCode,
  string
> {
  return Object.fromEntries(
    INVOICE_ROUTE_MARKET_CODES.map((code) => [code, getInvoiceRouteLabel(code)])
  ) as Record<InvoiceRouteMarketCode, string>;
}
