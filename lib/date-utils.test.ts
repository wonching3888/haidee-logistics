import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BUSINESS_TIMEZONE,
  DISPLAY_TIMEZONE,
  formatDisplay,
  formatDisplayDate,
  formatDisplayDateTime,
  formatDisplayTime,
  getDefaultDispatchDate,
  getDefaultInboundDate,
  toDateInputValue,
} from "@/lib/date-utils";

afterEach(() => {
  vi.useRealTimers();
});

describe("formatDisplay", () => {
  it("formats zero-padded ISO yyyy-MM-dd as dd/MM/yyyy", () => {
    expect(formatDisplay("2026-06-18")).toBe("18/06/2026");
  });

  it("pads unpadded month/day segments (e.g. AR charter preview)", () => {
    expect(formatDisplay("2026-6-18")).toBe("18/06/2026");
  });
});

describe("DISPLAY_TIMEZONE", () => {
  it("uses Asia/Bangkok (UTC+7)", () => {
    expect(DISPLAY_TIMEZONE).toBe("Asia/Bangkok");
    expect(BUSINESS_TIMEZONE).toBe("Asia/Bangkok");
  });
});

describe("formatDisplayDateTime", () => {
  it("formats UTC instant as Thailand local time (+7)", () => {
    const utc = new Date("2026-06-11T10:30:00.000Z");
    expect(formatDisplayDateTime(utc)).toBe("11/06/2026 17:30");
  });

  it("formats midnight UTC as 07:00 Bangkok same calendar day", () => {
    const utc = new Date("2026-06-11T00:00:00.000Z");
    expect(formatDisplayDateTime(utc)).toBe("11/06/2026 07:00");
  });
});

describe("formatDisplayTime", () => {
  it("shows HH:mm in Bangkok", () => {
    const utc = new Date("2026-06-11T10:30:00.000Z");
    expect(formatDisplayTime(utc)).toBe("17:30");
  });
});

describe("formatDisplayDate (@db.Date unchanged)", () => {
  it("still uses UTC calendar day for date-only fields", () => {
    const dbDate = new Date("2026-06-15T00:00:00.000Z");
    expect(formatDisplayDate(dbDate)).toBe("15/06/2026");
  });
});

describe("getDefaultDispatchDate 18:00 Bangkok cutoff", () => {
  it("returns today at 17:00 Bangkok", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T10:00:00.000Z"));
    expect(toDateInputValue(getDefaultDispatchDate())).toBe("2026-06-11");
  });

  it("returns tomorrow at 18:00 Bangkok", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T11:00:00.000Z"));
    expect(toDateInputValue(getDefaultDispatchDate())).toBe("2026-06-12");
  });

  it("returns tomorrow at 20:00 Bangkok", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T13:00:00.000Z"));
    expect(toDateInputValue(getDefaultDispatchDate())).toBe("2026-06-12");
  });
});

describe("getDefaultInboundDate shares Bangkok 18:00 cutoff", () => {
  it("matches dispatch default at 18:00 Bangkok", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T11:00:00.000Z"));
    expect(toDateInputValue(getDefaultInboundDate())).toBe("2026-06-12");
    expect(toDateInputValue(getDefaultDispatchDate())).toBe("2026-06-12");
  });
});
