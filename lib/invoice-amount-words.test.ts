import { describe, expect, it } from "vitest";
import {
  formatInvoiceAmountInWords,
  formatThaiBahtAmountInWords,
  integerToEnglishWords,
} from "@/lib/invoice-amount-words";

describe("invoice-amount-words", () => {
  it("converts integers to English words", () => {
    expect(integerToEnglishWords(0)).toBe("ZERO");
    expect(integerToEnglishWords(250)).toBe("TWO HUNDRED AND FIFTY");
    expect(integerToEnglishWords(163680)).toBe(
      "ONE HUNDRED AND SIXTY THREE THOUSAND SIX HUNDRED AND EIGHTY"
    );
  });

  it("formats THB amount in words", () => {
    expect(formatThaiBahtAmountInWords(250)).toBe(
      "THAI BAHT TWO HUNDRED AND FIFTY ONLY"
    );
    expect(formatThaiBahtAmountInWords(218260)).toBe(
      "THAI BAHT TWO HUNDRED AND EIGHTEEN THOUSAND TWO HUNDRED AND SIXTY ONLY"
    );
    expect(formatThaiBahtAmountInWords(1255.32)).toBe(
      "THAI BAHT ONE THOUSAND TWO HUNDRED AND FIFTY FIVE AND CENTS THIRTY TWO ONLY"
    );
    expect(formatThaiBahtAmountInWords(39505.32)).toBe(
      "THAI BAHT THIRTY NINE THOUSAND FIVE HUNDRED AND FIVE AND CENTS THIRTY TWO ONLY"
    );
  });

  it("formats currency-specific invoice words", () => {
    expect(formatInvoiceAmountInWords(100, "THB")).toContain("THAI BAHT");
    expect(formatInvoiceAmountInWords(100, "MYR")).toContain("RINGGIT MALAYSIA");
  });
});
