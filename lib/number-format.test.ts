import { describe, expect, it } from "vitest";
import {
  formatMoneyAmount,
  formatMoneyWithCurrency,
  formatQty,
} from "@/lib/number-format";

describe("formatMoneyAmount", () => {
  it("formats with thousand separators and 2 decimals", () => {
    expect(formatMoneyAmount(1234.5)).toBe("1,234.50");
    expect(formatMoneyAmount(100073)).toBe("100,073.00");
  });
});

describe("formatMoneyWithCurrency", () => {
  it("appends currency code", () => {
    expect(formatMoneyWithCurrency(1234.56, "MYR")).toBe("1,234.56 MYR");
  });
});

describe("formatQty", () => {
  it("formats integers with thousand separators and no decimals", () => {
    expect(formatQty(1073)).toBe("1,073");
    expect(formatQty(2026)).toBe("2,026");
  });

  it("rounds fractional quantities", () => {
    expect(formatQty(1073.9)).toBe("1,074");
  });
});
