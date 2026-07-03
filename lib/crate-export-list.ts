import { getBangkokTodayDateInput } from "@/lib/date-utils";
import {
  getDefaultInboundDate,
  resolveDateParam,
  toDateInputValue,
} from "@/lib/inbound-utils";

/** Hard cap on grouped export batches returned for a single date. */
export const CRATE_EXPORT_LIST_LIMIT = 300;

/** Default list date = inbound business date (UTC+8, 18:00 cutoff). */
export function resolveCrateExportListDate(dateParam?: string): string {
  if (!dateParam) return toDateInputValue(getDefaultInboundDate());
  return resolveDateParam(dateParam);
}

/** Due-today panel date (Bangkok calendar day; defaults to today). */
export function resolveCrateExportDueDate(dueParam?: string): string {
  if (!dueParam) return getBangkokTodayDateInput();
  return resolveDateParam(dueParam);
}

export function isLiveCrateExportDueDate(
  dueDate: string,
  todayInput: string = getBangkokTodayDateInput()
): boolean {
  return dueDate === todayInput;
}

export interface CrateExportListRow {
  exportNo: string;
  date: string;
  shipperName: string;
  thVehiclePlate: string;
  totalActual: number;
  totalShortage: number;
  lineCount: number;
}
