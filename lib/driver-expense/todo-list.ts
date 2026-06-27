import { differenceInCalendarDays } from "date-fns";
import { parseDateInput, toDateInputValue } from "@/lib/date-utils";

import type { DriverVoucherTripSource } from "@/lib/driver-expense/trip-source";

/** Days unsettled before highlighting in red (inclusive). */
export const TODO_UNSETTLED_ALERT_DAYS = 7;

export const TODO_VOUCHER_STATUSES = [
  "clerk_entered",
  "pending_review",
  "rejected",
] as const;

export type TodoVoucherStatus = (typeof TODO_VOUCHER_STATUSES)[number];

export type DriverExpenseTodoKind = "unentered" | "voucher";

export interface DriverExpenseTodoItem {
  kind: DriverExpenseTodoKind;
  tripId: string;
  tripSource: DriverVoucherTripSource;
  tripDate: string;
  lorry: string;
  driverName: string;
  route: string;
  dispatchNo: string | null;
  charterNo: string | null;
  voucherId?: string;
  voucherNo?: string;
  /** `unentered` or a voucher workflow status. */
  status: string;
  unsettledDays: number;
}

export function computeUnsettledDays(
  tripDate: string,
  today: Date = new Date()
): number {
  const trip = parseDateInput(tripDate);
  const todayUtc = parseDateInput(toDateInputValue(today));
  return Math.max(0, differenceInCalendarDays(todayUtc, trip));
}

export function sortDriverExpenseTodoItems(
  items: DriverExpenseTodoItem[]
): DriverExpenseTodoItem[] {
  return [...items].sort((a, b) => {
    const aPendingReview = a.status === "pending_review" ? 0 : 1;
    const bPendingReview = b.status === "pending_review" ? 0 : 1;
    if (aPendingReview !== bPendingReview) {
      return aPendingReview - bPendingReview;
    }
    if (a.unsettledDays !== b.unsettledDays) {
      return b.unsettledDays - a.unsettledDays;
    }
    return b.tripDate.localeCompare(a.tripDate);
  });
}

export function buildUnenteredTodoHref(item: DriverExpenseTodoItem): string {
  const params = new URLSearchParams({
    date: item.tripDate,
    tripId: item.tripId,
  });
  if (item.tripSource === "charter") {
    params.set("tripSource", "charter");
  }
  return `/documents/driver-expenses/new?${params.toString()}`;
}

export function buildVoucherTodoHref(item: DriverExpenseTodoItem): string {
  return `/documents/driver-expenses/${item.voucherId}?date=${item.tripDate}`;
}

export function isTodoUnsettledAlert(unsettledDays: number): boolean {
  return unsettledDays >= TODO_UNSETTLED_ALERT_DAYS;
}
