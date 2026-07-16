/** Fixed A5 landscape voucher print: 5 detail slots per page. */

export const VOUCHER_PRINT_LINES_PER_PAGE = 5;

export type VoucherPrintLineSlot = {
  particulars: string | null;
  amount: number | null;
};

/** Split detail lines into pages of `perPage` (default 5). Empty input → one empty page. */
export function paginateVoucherPrintLines<T>(
  lines: T[],
  perPage: number = VOUCHER_PRINT_LINES_PER_PAGE
): T[][] {
  if (perPage < 1) throw new Error("perPage must be >= 1");
  if (lines.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < lines.length; i += perPage) {
    pages.push(lines.slice(i, i + perPage));
  }
  return pages;
}

/** Pad a page's lines to exactly `perPage` slots (null = blank bordered row). */
export function padVoucherPrintSlots<T>(
  pageLines: T[],
  perPage: number = VOUCHER_PRINT_LINES_PER_PAGE
): Array<T | null> {
  const slots: Array<T | null> = [...pageLines];
  while (slots.length < perPage) slots.push(null);
  return slots.slice(0, perPage);
}

export function expectedVoucherPrintPageCount(
  lineCount: number,
  perPage: number = VOUCHER_PRINT_LINES_PER_PAGE
): number {
  if (lineCount <= 0) return 1;
  return Math.ceil(lineCount / perPage);
}
