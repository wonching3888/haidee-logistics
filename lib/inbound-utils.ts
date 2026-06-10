import {
  DISPLAY_DATE_FORMAT,
  formatDisplay,
  formatDisplayDate,
  parseDateInput,
  resolveDateParam,
  toDateInputValue,
} from "@/lib/date-utils";

export {
  DISPLAY_DATE_FORMAT,
  formatDisplay,
  formatDisplayDate,
  parseDateInput,
  resolveDateParam,
  toDateInputValue,
};

export interface InboundLineInput {
  stallId: string;
  tongTypeId: string;
  quantity: number;
  lineId?: string;
}

export function computeMarketTotals(
  lines: { marketCode: string; quantity: number }[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const line of lines) {
    if (line.quantity > 0 && line.marketCode) {
      totals[line.marketCode] = (totals[line.marketCode] ?? 0) + line.quantity;
    }
  }
  return totals;
}

/** @deprecated Use formatDisplayDate */
export function formatInboundDate(date: Date): string {
  return formatDisplayDate(date);
}
