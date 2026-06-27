import { subDays } from "date-fns";
import { parseDateInput, toDateInputValue } from "@/lib/date-utils";
import type { DriverVoucherTripSource } from "@/lib/driver-expense/trip-source";

export type DriverExpensesTab = "today" | "history";

export interface DriverVoucherListItem {
  id: string;
  voucherNo: string;
  tripId: string;
  tripSource: DriverVoucherTripSource;
  tripDate: string;
  lorry: string;
  driverName: string;
  route: string;
  status: string;
  duitJalan: number | null;
  belanja: number | null;
  baki: number | null;
}

export function normalizeVoucherListItem(
  row: {
    id: string;
    voucherNo: string;
    tripId: string;
    tripSource?: string | null;
    tripDate: Date | string;
    lorry: string;
    driverName: string;
    route: string;
    status: string;
    duitJalan: number | null;
    belanja: number | null;
    baki: number | null;
  }
): DriverVoucherListItem {
  const tripDate =
    typeof row.tripDate === "string"
      ? row.tripDate.slice(0, 10)
      : toDateInputValue(row.tripDate);
  const tripSource: DriverVoucherTripSource =
    row.tripSource === "charter" ? "charter" : "dispatch";
  return { ...row, tripDate, tripSource };
}

export function defaultHistoryDateRange(endDate?: string): {
  from: string;
  to: string;
} {
  const to = endDate ?? toDateInputValue(new Date());
  const end = parseDateInput(to);
  const start = subDays(end, 6);
  return { from: toDateInputValue(start), to };
}

export function parseDriverExpensesTab(
  value: string | null | undefined
): DriverExpensesTab {
  return value === "history" ? "history" : "today";
}

export interface DispatchOption {
  id: string;
  lorry: string;
  driver: string;
  route: string;
  tripSource?: DriverVoucherTripSource;
  charterNo?: string | null;
}

export type DispatchTripStatus = string | "none";

export interface ExpenseTripRow {
  tripId: string;
  tripSource: DriverVoucherTripSource;
  tripDate: string;
  lorry: string;
  driverName: string;
  route: string;
  charterNo: string | null;
  voucherId?: string;
  status: DispatchTripStatus;
}

/** @deprecated Use ExpenseTripRow */
export type DispatchTripRow = ExpenseTripRow;

export function buildExpenseTripRows(
  date: string,
  trips: DispatchOption[],
  vouchers: DriverVoucherListItem[]
): ExpenseTripRow[] {
  const byKey = new Map(
    vouchers.map((v) => [`${v.tripSource}:${v.tripId}`, v])
  );
  return trips.map((t) => {
    const tripSource = t.tripSource ?? "dispatch";
    const voucher = byKey.get(`${tripSource}:${t.id}`);
    return {
      tripId: t.id,
      tripSource,
      tripDate: date,
      lorry: t.lorry,
      driverName: t.driver,
      route: t.route,
      charterNo: t.charterNo ?? null,
      voucherId: voucher?.id,
      status: voucher?.status ?? "none",
    };
  });
}

export function buildDispatchTripRows(
  date: string,
  dispatches: DispatchOption[],
  vouchers: DriverVoucherListItem[]
): ExpenseTripRow[] {
  return buildExpenseTripRows(date, dispatches, vouchers);
}

const TODO_STATUS_ORDER: Record<string, number> = {
  pending_review: 0,
  rejected: 1,
  draft: 2,
};

export function sortTodoVouchers(
  vouchers: DriverVoucherListItem[]
): DriverVoucherListItem[] {
  return [...vouchers].sort((a, b) => {
    const orderA = TODO_STATUS_ORDER[a.status] ?? 99;
    const orderB = TODO_STATUS_ORDER[b.status] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return b.tripDate.localeCompare(a.tripDate);
  });
}

export const TODO_STATUS_IN = "draft,pending_review,rejected";
