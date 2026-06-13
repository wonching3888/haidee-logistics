import { formatDisplayDate, toDateInputValue } from "@/lib/date-utils";

export type PeriodReportMode = "monthly" | "yearly";

export interface PeriodReportColumn {
  code: string;
  header: string;
}

export interface PeriodReportRow {
  key: string;
  label: string;
  rowTotal: number;
  values: Record<string, number>;
  isTotal?: boolean;
}

export interface PeriodReportData {
  mode: PeriodReportMode;
  year: number;
  month: number | null;
  periodLabel: string;
  columns: PeriodReportColumn[];
  rows: PeriodReportRow[];
  grandTotal: number;
}

export const MONTH_LABELS = [
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

export function calendarDateUTC(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

export function getMonthDateRange(year: number, month: number) {
  const start = calendarDateUTC(year, month, 1);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = calendarDateUTC(year, month, lastDay);
  return { start, end, lastDay };
}

export function getYearDateRange(year: number) {
  return {
    start: calendarDateUTC(year, 1, 1),
    end: calendarDateUTC(year, 12, 31),
  };
}

export function addToBucket(
  bucket: Record<string, Record<string, number>>,
  rowKey: string,
  columnCode: string,
  quantity: number
) {
  if (!bucket[rowKey]) bucket[rowKey] = {};
  bucket[rowKey][columnCode] = (bucket[rowKey][columnCode] ?? 0) + quantity;
}

export function pickColumnValues(
  values: Record<string, number>,
  activeCodes: readonly string[]
): Record<string, number> {
  const picked: Record<string, number> = {};
  for (const code of activeCodes) {
    const qty = values[code] ?? 0;
    if (qty > 0) picked[code] = qty;
  }
  return picked;
}

export function sumActiveColumns(
  values: Record<string, number>,
  activeCodes: readonly string[]
): number {
  return activeCodes.reduce((sum, code) => sum + (values[code] ?? 0), 0);
}

export function buildPeriodReport(input: {
  mode: PeriodReportMode;
  year: number;
  month: number;
  entries: {
    dateKey: string;
    monthKey: string;
    columnCode: string;
    quantity: number;
  }[];
  buildColumns: (columnTotals: Record<string, number>) => PeriodReportColumn[];
}): PeriodReportData {
  const { mode, year, month, entries, buildColumns } = input;

  if (mode === "monthly") {
    const { lastDay } = getMonthDateRange(year, month);
    const byDay: Record<string, Record<string, number>> = {};
    const columnTotals: Record<string, number> = {};

    for (const entry of entries) {
      addToBucket(byDay, entry.dateKey, entry.columnCode, entry.quantity);
      columnTotals[entry.columnCode] =
        (columnTotals[entry.columnCode] ?? 0) + entry.quantity;
    }

    const columns = buildColumns(columnTotals);
    const activeCodes = columns.map((column) => column.code);
    const rows: PeriodReportRow[] = [];

    for (let day = 1; day <= lastDay; day++) {
      const date = calendarDateUTC(year, month, day);
      const key = toDateInputValue(date);
      const values = byDay[key] ?? {};
      rows.push({
        key,
        label: formatDisplayDate(date),
        rowTotal: sumActiveColumns(values, activeCodes),
        values: pickColumnValues(values, activeCodes),
      });
    }

    const grandValues = pickColumnValues(columnTotals, activeCodes);
    const grandTotal = sumActiveColumns(columnTotals, activeCodes);

    rows.push({
      key: "total",
      label: "当月总计 Month Total",
      rowTotal: grandTotal,
      values: grandValues,
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

  const byMonth: Record<string, Record<string, number>> = {};
  const columnTotals: Record<string, number> = {};

  for (const entry of entries) {
    addToBucket(byMonth, entry.monthKey, entry.columnCode, entry.quantity);
    columnTotals[entry.columnCode] =
      (columnTotals[entry.columnCode] ?? 0) + entry.quantity;
  }

  const columns = buildColumns(columnTotals);
  const activeCodes = columns.map((column) => column.code);
  const rows: PeriodReportRow[] = [];

  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, "0")}`;
    const values = byMonth[monthKey] ?? {};
    rows.push({
      key: monthKey,
      label: `${m}月 ${MONTH_LABELS[m - 1]}`,
      rowTotal: sumActiveColumns(values, activeCodes),
      values: pickColumnValues(values, activeCodes),
    });
  }

  const grandValues = pickColumnValues(columnTotals, activeCodes);
  const grandTotal = sumActiveColumns(columnTotals, activeCodes);

  rows.push({
    key: "total",
    label: "全年总计 Year Total",
    rowTotal: grandTotal,
    values: grandValues,
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
