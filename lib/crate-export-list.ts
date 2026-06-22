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

export interface CrateExportListRow {
  exportNo: string;
  date: string;
  shipperName: string;
  thVehiclePlate: string;
  totalActual: number;
  totalShortage: number;
  lineCount: number;
}
