"use server";

import { getMarketDisplayName } from "@/lib/constants/market-names";
import { MARKET_ORDER, getActiveMarkets } from "@/lib/markets";
import { requirePnlAccess } from "@/lib/require-auth";
import {
  fetchCharterMarketEntries,
  fetchDispatchBoxQuantity,
  fetchMarketDispatchEntries,
} from "@/lib/reports/fetch-dispatch-quantities";
import {
  buildPeriodReport,
  getMonthDateRange,
  getYearDateRange,
  type PeriodReportData,
  type PeriodReportMode,
} from "@/lib/reports/period-report-shared";

export type { PeriodReportMode as MarketReportMode };
export type MarketReportData = PeriodReportData;

function buildMarketColumns(columnTotals: Record<string, number>) {
  return getActiveMarkets(columnTotals, MARKET_ORDER).map((code) => ({
    code,
    header: getMarketDisplayName(code),
  }));
}

export async function getMarketReport(input: {
  mode: PeriodReportMode;
  year: number;
  month?: number;
}): Promise<PeriodReportData> {
  await requirePnlAccess();

  const { mode, year } = input;
  const month = input.month ?? new Date().getMonth() + 1;

  if (month < 1 || month > 12) {
    throw new Error("Invalid month");
  }

  const range =
    mode === "monthly"
      ? getMonthDateRange(year, month)
      : getYearDateRange(year);

  const [dispatchEntries, charterEntries, boxTotal] = await Promise.all([
    fetchMarketDispatchEntries(range.start, range.end),
    fetchCharterMarketEntries(range.start, range.end),
    fetchDispatchBoxQuantity(range.start, range.end),
  ]);

  return buildPeriodReport({
    mode,
    year,
    month,
    entries: [...dispatchEntries, ...charterEntries],
    buildColumns: buildMarketColumns,
    supplementalBoxTotal: boxTotal,
  });
}
