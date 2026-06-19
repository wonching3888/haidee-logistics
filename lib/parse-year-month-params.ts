/** Matches server-side year/month validation in invoice actions. */
export const LIST_YEAR_MIN = 2000;
export const LIST_YEAR_MAX = 2100;

export function currentCalendarYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function isValidListYear(year: number): boolean {
  return Number.isInteger(year) && year >= LIST_YEAR_MIN && year <= LIST_YEAR_MAX;
}

export function isValidListMonth(month: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

function parsePositiveInt(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isInteger(value)) return null;
  return value;
}

export function parseYearMonthFromSearchParams(
  searchParams: Pick<URLSearchParams, "get">
): { year: number; month: number } {
  const defaults = currentCalendarYearMonth();
  const year = parsePositiveInt(searchParams.get("year"));
  const month = parsePositiveInt(searchParams.get("month"));
  return {
    year: year !== null && isValidListYear(year) ? year : defaults.year,
    month: month !== null && isValidListMonth(month) ? month : defaults.month,
  };
}

/** True when URL already has the exact year/month strings we expect. */
export function yearMonthQueryMatches(
  searchParams: Pick<URLSearchParams, "get">,
  year: number,
  month: number
): boolean {
  return (
    searchParams.get("year") === String(year) &&
    searchParams.get("month") === String(month)
  );
}
