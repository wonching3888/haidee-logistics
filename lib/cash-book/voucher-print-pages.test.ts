import { describe, expect, it } from "vitest";
import {
  expectedVoucherPrintPageCount,
  padVoucherPrintSlots,
  paginateVoucherPrintLines,
  VOUCHER_PRINT_LINES_PER_PAGE,
} from "@/lib/cash-book/voucher-print-pages";

describe("voucher-print-pages", () => {
  it("uses 5 lines per page", () => {
    expect(VOUCHER_PRINT_LINES_PER_PAGE).toBe(5);
  });

  it("empty lines → one empty page", () => {
    expect(paginateVoucherPrintLines([])).toEqual([[]]);
    expect(expectedVoucherPrintPageCount(0)).toBe(1);
  });

  it("1–5 lines → one page", () => {
    expect(paginateVoucherPrintLines([1]).length).toBe(1);
    expect(paginateVoucherPrintLines([1, 2, 3, 4, 5]).length).toBe(1);
    expect(expectedVoucherPrintPageCount(5)).toBe(1);
  });

  it("6 lines → two pages", () => {
    const pages = paginateVoucherPrintLines([1, 2, 3, 4, 5, 6]);
    expect(pages).toEqual([[1, 2, 3, 4, 5], [6]]);
    expect(expectedVoucherPrintPageCount(6)).toBe(2);
  });

  it("pads slots to exactly 5", () => {
    expect(padVoucherPrintSlots([1, 2])).toEqual([1, 2, null, null, null]);
    expect(padVoucherPrintSlots([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
  });
});
