"use server";

import {
  mapTongToColumn,
  orderActiveTongColumns,
} from "@/lib/constants/tong-columns";
import { requirePnlAccess } from "@/lib/require-auth";
import {
  fetchCharterCrateEntries,
  fetchCrateDispatchEntries,
} from "@/lib/reports/fetch-dispatch-quantities";
import {
  buildPeriodReport,
  getMonthDateRange,
  getYearDateRange,
  type PeriodReportData,
  type PeriodReportMode,
} from "@/lib/reports/period-report-shared";

export type { PeriodReportMode as CrateReportMode };
export type CrateReportData = PeriodReportData;

function buildCrateColumns(columnTotals: Record<string, number>) {
  return orderActiveTongColumns(columnTotals).map((column) => ({
    code: column.code,
    header: column.header,
  }));
}

export async function getCrateReport(input: {
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

  const [dispatchEntries, charterEntries] = await Promise.all([
    fetchCrateDispatchEntries(range.start, range.end, mapTongToColumn),
    fetchCharterCrateEntries(range.start, range.end, mapTongToColumn),
  ]);

  return buildPeriodReport({
    mode,
    year,
    month,
    entries: [...dispatchEntries, ...charterEntries],
    buildColumns: buildCrateColumns,
  });
}
