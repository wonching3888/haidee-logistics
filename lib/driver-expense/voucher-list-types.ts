import { subDays } from "date-fns";
import { parseDateInput, toDateInputValue } from "@/lib/date-utils";

export type DriverExpensesTab = "today" | "history";

export interface DriverVoucherListItem {
  id: string;
  voucherNo: string;
  tripId: string;
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
  return { ...row, tripDate };
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
}

export type DispatchTripStatus = string | "none";

export interface DispatchTripRow {
  tripId: string;
  tripDate: string;
  lorry: string;
  driverName: string;
  route: string;
  voucherId?: string;
  status: DispatchTripStatus;
}

export function buildDispatchTripRows(
  date: string,
  dispatches: DispatchOption[],
  vouchers: DriverVoucherListItem[]
): DispatchTripRow[] {
  const byTripId = new Map(vouchers.map((v) => [v.tripId, v]));
  return dispatches.map((d) => {
    const voucher = byTripId.get(d.id);
    return {
      tripId: d.id,
      tripDate: date,
      lorry: d.lorry,
      driverName: d.driver,
      route: d.route,
      voucherId: voucher?.id,
      status: voucher?.status ?? "none",
    };
  });
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
