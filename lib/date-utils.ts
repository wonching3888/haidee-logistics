import { format, isValid, parse } from "date-fns";

export const DISPLAY_DATE_FORMAT = "dd/MM/yyyy";
const ISO_DATE_FORMAT = "yyyy-MM-dd";

/** User-facing date display: dd/MM/yyyy */
export function formatDisplayDate(date: Date): string {
  return format(date, DISPLAY_DATE_FORMAT);
}

/** Native <input type="date"> value & URL storage: yyyy-MM-dd */
export function toDateInputValue(date: Date): string {
  return format(date, ISO_DATE_FORMAT);
}

export function parseDateInput(value: string): Date {
  const trimmed = value.trim();
  if (!trimmed) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // Primary: ISO yyyy-MM-dd (native date input & URLs)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  // Legacy: dd/MM/yyyy display strings
  const parsed = parse(trimmed, DISPLAY_DATE_FORMAT, new Date());
  if (isValid(parsed)) return parsed;

  const parts = trimmed.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts.map((p) => parseInt(p, 10));
    if (!Number.isNaN(d) && !Number.isNaN(m) && !Number.isNaN(y)) {
      const date = new Date(y, m - 1, d);
      if (isValid(date)) return date;
    }
  }

  throw new Error(`Invalid date: ${value}`);
}

/** Normalize URL/search param to ISO for date inputs */
export function resolveDateParam(dateParam?: string): string {
  if (!dateParam) return toDateInputValue(new Date());
  return toDateInputValue(parseDateInput(dateParam));
}
