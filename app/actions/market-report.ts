"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getMarketDisplayName } from "@/lib/constants/market-names";
import { MARKET_ORDER, getActiveMarkets } from "@/lib/markets";
import { formatDisplayDate, toDateInputValue } from "@/lib/date-utils";

export type MarketReportMode = "monthly" | "yearly";

export interface MarketReportColumn {
  code: string;
  header: string;
}

export interface MarketReportRow {
  key: string;
  label: string;
  rowTotal: number;
  markets: Record<string, number>;
  isTotal?: boolean;
}

export interface MarketReportData {
  mode: MarketReportMode;
  year: number;
  month: number | null;
  periodLabel: string;
  columns: MarketReportColumn[];
  rows: MarketReportRow[];
  grandTotal: number;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function calendarDateUTC(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

function getMonthDateRange(year: number, month: number) {
  const start = calendarDateUTC(year, month, 1);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = calendarDateUTC(year, month, lastDay);
  return { start, end, lastDay };
}

function getYearDateRange(year: number) {
  return {
    start: calendarDateUTC(year, 1, 1),
    end: calendarDateUTC(year, 12, 31),
  };
}

interface DispatchQuantityEntry {
  dateKey: string;
  monthKey: string;
  marketCode: string;
  quantity: number;
}

async function fetchBarrelQuantitiesByDispatchDate(
  start: Date,
  end: Date
): Promise<DispatchQuantityEntry[]> {
  const lines = await prisma.inboundLine.findMany({
    where: {
      dispatchStatus: "assigned",
      isBox: false,
      dispatchLines: {
        some: {
          dispatchOrder: {
            date: { gte: start, lte: end },
            status: { notIn: ["draft", "cancelled"] },
          },
        },
      },
    },
    include: {
      stall: { include: { market: true } },
      dispatchLines: {
        include: { dispatchOrder: { select: { date: true } } },
      },
    },
  });

  const entries: DispatchQuantityEntry[] = [];

  for (const line of lines) {
    const dispatchLine = line.dispatchLines[0];
    if (!dispatchLine) continue;

    const marketCode = line.stall.market?.code;
    if (!marketCode) continue;

    const dispatchDate = dispatchLine.dispatchOrder.date;
    const dateKey = toDateInputValue(dispatchDate);
    const y = dispatchDate.getUTCFullYear();
    const m = dispatchDate.getUTCMonth() + 1;

    entries.push({
      dateKey,
      monthKey: `${y}-${String(m).padStart(2, "0")}`,
      marketCode,
      quantity: line.quantity,
    });
  }

  return entries;
}

function buildColumns(
  columnTotals: Record<string, number>
): MarketReportColumn[] {
  return getActiveMarkets(columnTotals, MARKET_ORDER).map((code) => ({
    code,
    header: getMarketDisplayName(code),
  }));
}

function addToBucket(
  bucket: Record<string, Record<string, number>>,
  rowKey: string,
  marketCode: string,
  quantity: number
) {
  if (!bucket[rowKey]) bucket[rowKey] = {};
  bucket[rowKey][marketCode] =
    (bucket[rowKey][marketCode] ?? 0) + quantity;
}

function pickMarketValues(
  markets: Record<string, number>,
  activeCodes: readonly string[]
): Record<string, number> {
  const picked: Record<string, number> = {};
  for (const code of activeCodes) {
    const qty = markets[code] ?? 0;
    if (qty > 0) picked[code] = qty;
  }
  return picked;
}

function sumActiveMarkets(
  markets: Record<string, number>,
  activeCodes: readonly string[]
): number {
  return activeCodes.reduce((sum, code) => sum + (markets[code] ?? 0), 0);
}

export async function getMarketReport(input: {
  mode: MarketReportMode;
  year: number;
  month?: number;
}): Promise<MarketReportData> {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  const { mode, year } = input;
  const month = input.month ?? new Date().getMonth() + 1;

  if (month < 1 || month > 12) {
    throw new Error("Invalid month");
  }

  if (mode === "monthly") {
    const { start, end, lastDay } = getMonthDateRange(year, month);
    const entries = await fetchBarrelQuantitiesByDispatchDate(start, end);

    const byDay: Record<string, Record<string, number>> = {};
    const columnTotals: Record<string, number> = {};

    for (const entry of entries) {
      addToBucket(byDay, entry.dateKey, entry.marketCode, entry.quantity);
      columnTotals[entry.marketCode] =
        (columnTotals[entry.marketCode] ?? 0) + entry.quantity;
    }

    const columns = buildColumns(columnTotals);
    const activeCodes = columns.map((column) => column.code);
    const rows: MarketReportRow[] = [];

    for (let day = 1; day <= lastDay; day++) {
      const date = calendarDateUTC(year, month, day);
      const key = toDateInputValue(date);
      const markets = byDay[key] ?? {};
      rows.push({
        key,
        label: formatDisplayDate(date),
        rowTotal: sumActiveMarkets(markets, activeCodes),
        markets: pickMarketValues(markets, activeCodes),
      });
    }

    const grandMarkets = pickMarketValues(columnTotals, activeCodes);
    const grandTotal = sumActiveMarkets(columnTotals, activeCodes);

    rows.push({
      key: "total",
      label: "当月总计 Month Total",
      rowTotal: grandTotal,
      markets: grandMarkets,
      isTotal: true,
    });

    return {
      mode,
      year,
      month,
      periodLabel: `${MONTH_LABELS[month - 1]} ${year}`,
      columns,
      rows,
      grandTotal,
    };
  }

  const { start, end } = getYearDateRange(year);
  const entries = await fetchBarrelQuantitiesByDispatchDate(start, end);

  const byMonth: Record<string, Record<string, number>> = {};
  const columnTotals: Record<string, number> = {};

  for (const entry of entries) {
    addToBucket(byMonth, entry.monthKey, entry.marketCode, entry.quantity);
    columnTotals[entry.marketCode] =
      (columnTotals[entry.marketCode] ?? 0) + entry.quantity;
  }

  const columns = buildColumns(columnTotals);
  const activeCodes = columns.map((column) => column.code);
  const rows: MarketReportRow[] = [];

  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, "0")}`;
    const markets = byMonth[monthKey] ?? {};
    rows.push({
      key: monthKey,
      label: `${m}月 ${MONTH_LABELS[m - 1]}`,
      rowTotal: sumActiveMarkets(markets, activeCodes),
      markets: pickMarketValues(markets, activeCodes),
    });
  }

  const grandMarkets = pickMarketValues(columnTotals, activeCodes);
  const grandTotal = sumActiveMarkets(columnTotals, activeCodes);

  rows.push({
    key: "total",
    label: "全年总计 Year Total",
    rowTotal: grandTotal,
    markets: grandMarkets,
    isTotal: true,
  });

  return {
    mode: "yearly",
    year,
    month: null,
    periodLabel: String(year),
    columns,
    rows,
    grandTotal,
  };
}
