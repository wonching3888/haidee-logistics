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
