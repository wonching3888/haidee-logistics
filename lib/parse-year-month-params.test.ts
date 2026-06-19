import { describe, expect, it } from "vitest";
import {
  parseYearMonthFromSearchParams,
  yearMonthQueryMatches,
} from "./parse-year-month-params";

function params(input: Record<string, string>) {
  return new URLSearchParams(input);
}

describe("parseYearMonthFromSearchParams", () => {
  it("defaults when params are missing", () => {
    const { year, month } = parseYearMonthFromSearchParams(params({}));
    expect(year).toBeGreaterThanOrEqual(2000);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });

  it("does not treat Number(null) as year 0", () => {
    const parsed = parseYearMonthFromSearchParams(params({ month: "6" }));
    expect(parsed.year).not.toBe(0);
    expect(parsed.month).toBe(6);
  });

  it("rejects invalid year and month", () => {
    const parsed = parseYearMonthFromSearchParams(
      params({ year: "abc", month: "99" })
    );
    expect(parsed.year).toBeGreaterThanOrEqual(2000);
    expect(parsed.month).toBeGreaterThanOrEqual(1);
    expect(parsed.month).toBeLessThanOrEqual(12);
  });

  it("accepts valid year and month", () => {
    const parsed = parseYearMonthFromSearchParams(
      params({ year: "2026", month: "6" })
    );
    expect(parsed).toEqual({ year: 2026, month: 6 });
  });
});

describe("yearMonthQueryMatches", () => {
  it("returns false when query params are missing", () => {
    expect(yearMonthQueryMatches(params({}), 2026, 6)).toBe(false);
  });

  it("returns true when query matches state", () => {
    expect(
      yearMonthQueryMatches(params({ year: "2026", month: "6" }), 2026, 6)
    ).toBe(true);
  });
});
