"use server";

import { requirePnlAccess } from "@/lib/require-auth";
import { mapTongToColumn, orderActiveTongColumns } from "@/lib/constants/tong-columns";
import { getMarketDisplayName } from "@/lib/constants/market-names";
import { MARKET_ORDER, getActiveMarkets } from "@/lib/markets";
import {
  fetchCrateReturnMarketEntries,
  fetchCrateReturnTypeEntries,
} from "@/lib/reports/fetch-crate-return-quantities";
import {
  buildPeriodReport,
  getMonthDateRange,
  getYearDateRange,
  type PeriodReportData,
  type PeriodReportMode,
} from "@/lib/reports/period-report-shared";

export type { PeriodReportMode as CrateReturnReportMode };
export type CrateReturnReportData = PeriodReportData;

function buildMarketColumns(columnTotals: Record<string, number>) {
  return getActiveMarkets(columnTotals, MARKET_ORDER).map((code) => ({
    code,
    header: getMarketDisplayName(code),
  }));
}

function buildCrateColumns(columnTotals: Record<string, number>) {
  return orderActiveTongColumns(columnTotals).map((column) => ({
    code: column.code,
    header: column.header,
  }));
}

function resolveRange(mode: PeriodReportMode, year: number, month: number) {
  return mode === "monthly" ? getMonthDateRange(year, month) : getYearDateRange(year);
}

export async function getCrateReturnMarketReport(input: {
  mode: PeriodReportMode;
  year: number;
  month?: number;
}): Promise<PeriodReportData> {
  await requirePnlAccess();
  const { mode, year } = input;
  const month = input.month ?? new Date().getMonth() + 1;
  if (month < 1 || month > 12) throw new Error("Invalid month");

  const range = resolveRange(mode, year, month);
  const entries = await fetchCrateReturnMarketEntries(range.start, range.end);

  return buildPeriodReport({ mode, year, month, entries, buildColumns: buildMarketColumns });
}

export async function getCrateReturnTypeReport(input: {
  mode: PeriodReportMode;
  year: number;
  month?: number;
}): Promise<PeriodReportData> {
  await requirePnlAccess();
  const { mode, year } = input;
  const month = input.month ?? new Date().getMonth() + 1;
  if (month < 1 || month > 12) throw new Error("Invalid month");

  const range = resolveRange(mode, year, month);
  const entries = await fetchCrateReturnTypeEntries(range.start, range.end, mapTongToColumn);

  return buildPeriodReport({ mode, year, month, entries, buildColumns: buildCrateColumns });
}
