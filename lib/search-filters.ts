import { DISPATCH_MARKET_ORDER } from "@/lib/markets";

export const SEARCH_RESULT_LIMIT = 3000;

export interface SearchFilters {
  fromDate: string;
  toDate: string;
  shipperId: string;
  marketCodes: string[];
  tongTypeId: string;
  plate: string;
  docNo: string;
  keyword: string;
}

export interface SearchFilterOptions {
  shippers: { id: string; name: string; code: string }[];
  tongTypes: { id: string; code: string; name: string }[];
}

type SearchParamsLike = {
  from?: string;
  to?: string;
  date?: string;
  shipperId?: string;
  market?: string;
  tongTypeId?: string;
  plate?: string;
  docNo?: string;
  keyword?: string;
  /** @deprecated use keyword */
  q?: string;
};

const VALID_MARKET_CODES = new Set<string>(DISPATCH_MARKET_ORDER);

export function parseMarketCodesParam(marketParam?: string): string[] {
  if (!marketParam?.trim()) return [];
  return marketParam
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter((code) => VALID_MARKET_CODES.has(code));
}

export function parseSearchFiltersFromParams(
  params: SearchParamsLike
): SearchFilters {
  const keyword = (params.keyword ?? params.q ?? "").trim();
  return {
    fromDate: params.from?.trim() ?? "",
    toDate: params.to?.trim() ?? "",
    shipperId: params.shipperId?.trim() ?? "",
    marketCodes: parseMarketCodesParam(params.market),
    tongTypeId: params.tongTypeId?.trim() ?? "",
    plate: params.plate?.trim() ?? "",
    docNo: params.docNo?.trim() ?? "",
    keyword,
  };
}

export function hasStructuredSearchCriteria(
  filters: Pick<
    SearchFilters,
    | "shipperId"
    | "marketCodes"
    | "tongTypeId"
    | "plate"
    | "docNo"
    | "keyword"
  >
): boolean {
  return !!(
    filters.shipperId ||
    filters.marketCodes.length > 0 ||
    filters.tongTypeId ||
    filters.plate.trim() ||
    filters.docNo.trim() ||
    filters.keyword.trim()
  );
}

export function hasActiveSearchFilters(filters: SearchFilters): boolean {
  return hasStructuredSearchCriteria(filters);
}

export function buildSearchFilterSummaryLines(
  filters: SearchFilters,
  options: SearchFilterOptions
): string[] {
  const lines: string[] = [];
  const shipper = options.shippers.find((s) => s.id === filters.shipperId);
  if (shipper) {
    lines.push(`寄货人 Consignor: ${shipper.name}`);
  }
  if (filters.marketCodes.length > 0) {
    lines.push(`市场 Market: ${filters.marketCodes.join(", ")}`);
  }
  const tongType = options.tongTypes.find((t) => t.id === filters.tongTypeId);
  if (tongType) {
    lines.push(`桶型 Crate: ${tongType.code}`);
  }
  if (filters.plate.trim()) {
    lines.push(`车牌 Plate: ${filters.plate.trim()}`);
  }
  if (filters.docNo.trim()) {
    lines.push(`单号 Doc No: ${filters.docNo.trim()}`);
  }
  if (filters.keyword.trim()) {
    lines.push(`备注/其他 Other: ${filters.keyword.trim()}`);
  }
  return lines;
}

export function searchFiltersToUrlParams(
  filters: SearchFilters,
  existing?: URLSearchParams
): URLSearchParams {
  const params = new URLSearchParams(existing?.toString() ?? "");
  params.set("from", filters.fromDate);
  params.set("to", filters.toDate);
  params.delete("date");
  params.delete("q");

  if (filters.shipperId) params.set("shipperId", filters.shipperId);
  else params.delete("shipperId");

  if (filters.marketCodes.length > 0) {
    params.set("market", filters.marketCodes.join(","));
  } else {
    params.delete("market");
  }

  if (filters.tongTypeId) params.set("tongTypeId", filters.tongTypeId);
  else params.delete("tongTypeId");

  if (filters.plate.trim()) params.set("plate", filters.plate.trim());
  else params.delete("plate");

  if (filters.docNo.trim()) params.set("docNo", filters.docNo.trim());
  else params.delete("docNo");

  if (filters.keyword.trim()) params.set("keyword", filters.keyword.trim());
  else params.delete("keyword");

  return params;
}
