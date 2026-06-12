import { format, isValid, parse } from "date-fns";

/** User-facing date: dd/mm/yyyy e.g. 11/06/2026 */
export const DISPLAY_DATE_FORMAT = "dd/MM/yyyy";
const ISO_DATE_FORMAT = "yyyy-MM-dd";

/** Normalize @db.Date / UTC-midnight values to local calendar date */
function toCalendarDate(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** ISO yyyy-MM-dd → display dd/MM/yyyy */
export function formatDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

/** User-facing date display: dd/MM/yyyy */
export function formatDisplayDate(date: Date): string {
  return format(toCalendarDate(date), DISPLAY_DATE_FORMAT);
}

/** Native <input type="date"> value & URL storage: yyyy-MM-dd */
export function toDateInputValue(date: Date): string {
  return format(toCalendarDate(date), ISO_DATE_FORMAT);
}

/** Store/query @db.Date as UTC midnight for the calendar day */
function calendarDateUTC(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

export function parseDateInput(value: string): Date {
  const trimmed = value.trim();
  if (!trimmed) {
    const now = new Date();
    return calendarDateUTC(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate()
    );
  }

  // Primary: ISO yyyy-MM-dd (native date input & URLs)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    return calendarDateUTC(y, m, d);
  }

  // Legacy: dd/MM/yyyy display strings
  const parsed = parse(trimmed, DISPLAY_DATE_FORMAT, new Date());
  if (isValid(parsed)) {
    return calendarDateUTC(
      parsed.getFullYear(),
      parsed.getMonth() + 1,
      parsed.getDate()
    );
  }

  const parts = trimmed.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts.map((p) => parseInt(p, 10));
    if (!Number.isNaN(d) && !Number.isNaN(m) && !Number.isNaN(y)) {
      const date = calendarDateUTC(y, m, d);
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

/** Resolve from/to URL params; supports legacy single `date` param. */
export function resolveDateRangeParams(
  fromParam?: string,
  toParam?: string,
  legacyDateParam?: string
): { from: string; to: string } {
  if (legacyDateParam && !fromParam && !toParam) {
    const date = resolveDateParam(legacyDateParam);
    return { from: date, to: date };
  }
  return {
    from: resolveDateParam(fromParam),
    to: resolveDateParam(toParam),
  };
}

/** Ensure from <= to (ISO yyyy-MM-dd strings). */
export function normalizeDateRange(from: string, to: string): { from: string; to: string } {
  if (from <= to) return { from, to };
  return { from: to, to: from };
}

/** Malaysia / Thailand business timezone (UTC+8) */
const BUSINESS_TIMEZONE = "Asia/Kuala_Lumpur";

function getZonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "0";

  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour: parseInt(get("hour"), 10) % 24,
  };
}

/** Default inbound date: today before 18:00, tomorrow from 18:00 (UTC+8). */
export function getDefaultInboundDate(): Date {
  const now = new Date();
  const { year, month, day, hour } = getZonedDateParts(now, BUSINESS_TIMEZONE);

  const base = calendarDateUTC(year, month, day);
  if (hour >= 18) {
    base.setUTCDate(base.getUTCDate() + 1);
  }
  return base;
}
