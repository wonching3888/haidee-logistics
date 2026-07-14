import { describe, expect, it } from "vitest";
import {
  CASH_BOOK_MYR_ACCOUNTS,
  CASH_BOOK_THB_ACCOUNTS,
  cashBookAccountsForLedger,
  findCashBookAccount,
} from "@/lib/constants/cash-book-accounts";
import {
  filterBlankPaymentVoucherLines,
  normalizePaymentVoucherLines,
  PaymentVoucherValidationError,
  sumPaymentVoucherLines,
} from "@/lib/cash-book/payment-voucher-lines";
import { formatInvoiceAmountInWords } from "@/lib/invoice-amount-words";

describe("cash-book-accounts", () => {
  it("has 24 THB and 14 MYR accounts (incl. 3500 driver advance)", () => {
    expect(CASH_BOOK_THB_ACCOUNTS).toHaveLength(24);
    expect(CASH_BOOK_MYR_ACCOUNTS).toHaveLength(14);
    expect(findCashBookAccount("MYR", "3500-0000")?.name).toContain(
      "DRIVER DUIT JALAN"
    );
  });

  it("returns ledger-specific account lists", () => {
    expect(cashBookAccountsForLedger("THB")[0]?.code).toBe("3202-0000");
    expect(cashBookAccountsForLedger("MYR")[0]?.code).toBe("3050-W001");
    expect(findCashBookAccount("THB", "6502-0000")?.name).toContain(
      "THAI G.WORKER WAGES"
    );
  });
});

describe("payment-voucher-lines", () => {
  it("sums line amounts", () => {
    expect(
      sumPaymentVoucherLines([{ amount: 100.5 }, { amount: 200.25 }])
    ).toBe(300.75);
  });

  it("filters fully blank lines before normalize", () => {
    const filtered = filterBlankPaymentVoucherLines([
      { accountCode: "6500-0000", particulars: "SK TRIP WAGES", amount: 700 },
      { accountCode: "", particulars: "", amount: Number("") },
      { accountCode: "  ", particulars: "x", amount: 0 },
    ]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.accountCode).toBe("6500-0000");
    expect(() => normalizePaymentVoucherLines("THB", filtered)).not.toThrow();
  });

  it("keeps partial rows so normalize can report field errors", () => {
    const filtered = filterBlankPaymentVoucherLines([
      { accountCode: "6500-0000", particulars: "x", amount: 0 },
      { accountCode: "", particulars: "y", amount: 50 },
    ]);
    expect(filtered).toHaveLength(2);
  });

  it("reports at least one line after blank filter empties input", () => {
    expect(
      filterBlankPaymentVoucherLines([
        { accountCode: "", particulars: "", amount: 0 },
        { accountCode: "", particulars: "", amount: Number("") },
      ])
    ).toHaveLength(0);
    expect(() =>
      normalizePaymentVoucherLines(
        "THB",
        filterBlankPaymentVoucherLines([
          { accountCode: "", amount: 0 },
          { accountCode: "", amount: 0 },
        ])
      )
    ).toThrow(/至少需要一行/);
  });

  it("requires account on every line", () => {
    expect(() =>
      normalizePaymentVoucherLines("THB", [
        { accountCode: "", particulars: "x", amount: 10 },
      ])
    ).toThrow(PaymentVoucherValidationError);
    expect(() =>
      normalizePaymentVoucherLines("THB", [
        { accountCode: "6500-0000", particulars: "ok", amount: 10 },
      ])
    ).not.toThrow();
  });

  it("rejects account from wrong ledger", () => {
    expect(() =>
      normalizePaymentVoucherLines("MYR", [
        { accountCode: "6500-0000", particulars: "trip", amount: 700 },
      ])
    ).toThrow(/不属于当前账本/);
  });

  it("rejects non-positive amounts", () => {
    expect(() =>
      normalizePaymentVoucherLines("THB", [
        { accountCode: "6500-0000", particulars: "x", amount: 0 },
      ])
    ).toThrow(/金额/);
  });
});

describe("payment voucher amount in words", () => {
  it("formats THB integer and decimal", () => {
    expect(formatInvoiceAmountInWords(1500, "THB")).toBe(
      "THAI BAHT ONE THOUSAND FIVE HUNDRED ONLY"
    );
    expect(formatInvoiceAmountInWords(1255.32, "THB")).toContain("CENTS THIRTY TWO");
  });

  it("formats MYR integer and decimal", () => {
    expect(formatInvoiceAmountInWords(500, "MYR")).toContain("RINGGIT MALAYSIA");
    expect(formatInvoiceAmountInWords(99.5, "MYR")).toContain("FIFTY SEN");
  });
});
