/**
 * Holiday-rate day detection for Sadao handling / attendance hints.
 * Holiday rate = Sunday OR date listed in thai_public_holidays.
 */

/** UTC calendar key yyyy-MM-dd for @db.Date values stored at UTC midnight. */
export function toUtcDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isSunday(date: Date): boolean {
  return date.getUTCDay() === 0;
}

export type HolidayRateReason = "sunday" | "public_holiday";

export interface HolidayRateInfo {
  isHolidayRate: boolean;
  reason: HolidayRateReason | null;
  /** Public holiday name when reason is public_holiday (Sunday alone has no name). */
  holidayName: string | null;
}

/**
 * Pure holiday-rate check.
 * @param publicHolidayKeys Set of yyyy-MM-dd keys from thai_public_holidays
 * @param publicHolidayNames optional map key → name for UI labels
 */
export function getHolidayRateInfo(
  date: Date,
  publicHolidayKeys: ReadonlySet<string>,
  publicHolidayNames?: ReadonlyMap<string, string>
): HolidayRateInfo {
  const key = toUtcDateKey(date);
  const isPublic = publicHolidayKeys.has(key);
  const sunday = isSunday(date);

  if (!sunday && !isPublic) {
    return { isHolidayRate: false, reason: null, holidayName: null };
  }

  // Prefer public_holiday label when both apply (Sunday that is also a named holiday).
  if (isPublic) {
    return {
      isHolidayRate: true,
      reason: "public_holiday",
      holidayName: publicHolidayNames?.get(key) ?? null,
    };
  }

  return { isHolidayRate: true, reason: "sunday", holidayName: null };
}

export function isHolidayRate(
  date: Date,
  publicHolidayKeys: ReadonlySet<string>
): boolean {
  return getHolidayRateInfo(date, publicHolidayKeys).isHolidayRate;
}

export function buildPublicHolidayKeySet(
  holidays: ReadonlyArray<{ date: Date }>
): Set<string> {
  return new Set(holidays.map((h) => toUtcDateKey(h.date)));
}

export function buildPublicHolidayNameMap(
  holidays: ReadonlyArray<{ date: Date; name: string }>
): Map<string, string> {
  return new Map(holidays.map((h) => [toUtcDateKey(h.date), h.name]));
}
