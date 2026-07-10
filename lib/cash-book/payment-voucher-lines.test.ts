import { describe, expect, it } from "vitest";
import {
  CASH_BOOK_MYR_ACCOUNTS,
  CASH_BOOK_THB_ACCOUNTS,
  cashBookAccountsForLedger,
  findCashBookAccount,
} from "@/lib/constants/cash-book-accounts";
import {
  normalizePaymentVoucherLines,
  PaymentVoucherValidationError,
  sumPaymentVoucherLines,
} from "@/lib/cash-book/payment-voucher-lines";
import { formatInvoiceAmountInWords } from "@/lib/invoice-amount-words";

describe("cash-book-accounts", () => {
  it("has 24 THB and 13 MYR accounts", () => {
    expect(CASH_BOOK_THB_ACCOUNTS).toHaveLength(24);
    expect(CASH_BOOK_MYR_ACCOUNTS).toHaveLength(13);
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
