/** S2 deep-link gate: only auto-query when URL contains q=1 */
export const REPORT_QUERY_PARAM = "q";

export function isReportQueryRequested(
  searchParams: Pick<URLSearchParams, "get"> | { q?: string | null }
): boolean {
  const q =
    "get" in searchParams
      ? searchParams.get(REPORT_QUERY_PARAM)
      : searchParams.q;
  return q === "1";
}

export function withReportQueryFlag(params: URLSearchParams): URLSearchParams {
  params.set(REPORT_QUERY_PARAM, "1");
  return params;
}

export const REPORT_YEAR_OPTIONS = Array.from(
  { length: 11 },
  (_, index) => 2020 + index
);

export const FILTERS_CHANGED_HINT =
  "筛选已变更，请点击查询更新 Filters changed, click Search to update";
