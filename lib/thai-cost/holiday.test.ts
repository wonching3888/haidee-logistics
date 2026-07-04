import { describe, expect, it } from "vitest";
import { calendarDateUTC } from "@/lib/reports/period-report-shared";
import {
  getHolidayRateInfo,
  isHolidayRate,
  isSunday,
  toUtcDateKey,
} from "@/lib/thai-cost/holiday";

describe("holiday rate detection", () => {
  it("detects Sunday via UTC day", () => {
    // 2026-06-07 is Sunday
    const sun = calendarDateUTC(2026, 6, 7);
    expect(isSunday(sun)).toBe(true);
    expect(isHolidayRate(sun, new Set())).toBe(true);
    expect(getHolidayRateInfo(sun, new Set()).reason).toBe("sunday");
  });

  it("detects weekday as non-holiday without public holiday", () => {
    // 2026-06-01 is Monday
    const mon = calendarDateUTC(2026, 6, 1);
    expect(isSunday(mon)).toBe(false);
    expect(isHolidayRate(mon, new Set())).toBe(false);
  });

  it("detects public holiday on weekday", () => {
    const day = calendarDateUTC(2026, 6, 3);
    const key = toUtcDateKey(day);
    const keys = new Set([key]);
    const names = new Map([[key, "泼水节"]]);
    expect(isHolidayRate(day, keys)).toBe(true);
    const info = getHolidayRateInfo(day, keys, names);
    expect(info.reason).toBe("public_holiday");
    expect(info.holidayName).toBe("泼水节");
  });

  it("prefers public_holiday label when Sunday is also named", () => {
    const sun = calendarDateUTC(2026, 6, 7);
    const key = toUtcDateKey(sun);
    const info = getHolidayRateInfo(
      sun,
      new Set([key]),
      new Map([[key, "某节日"]])
    );
    expect(info.isHolidayRate).toBe(true);
    expect(info.reason).toBe("public_holiday");
    expect(info.holidayName).toBe("某节日");
  });
});
