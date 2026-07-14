/**
 * AutoCount CSV export for MYR Cash Book Payment Voucher lines.
 *
 * Generic over all MYR confirmed PVs (manual + driver-voucher linked).
 * Filters to belanja whitelist 6301–6306 so advance-only (3500) vouchers
 * drop out entirely without a special-case skip.
 */

import {
  DRIVER_VOUCHER_ADVANCE_ACCOUNT_CODE,
  isDriverVoucherAutocountAccountCode,
} from "@/lib/constants/cash-book-accounts";
import { toDateInputValue } from "@/lib/date-utils";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";

export const CASH_BOOK_PV_AUTOCOUNT_CSV_HEADERS = [
  "DocNo",
  "DocDate",
  "PaidTo",
  "AccNo",
  "AccountName",
  "Description",
  "Amount",
  "PaymentMethod",
] as const;

export type CashBookPvAutocountCsvRow = {
  docNo: string;
  docDate: string;
  paidTo: string;
  accNo: string;
  accountName: string;
  description: string;
  amount: number;
  paymentMethod: string;
};

export function filterCashBookPvLinesForAutocountExport<
  T extends { accountCode: string },
>(lines: T[]): T[] {
  return lines.filter((line) =>
    isDriverVoucherAutocountAccountCode(line.accountCode)
  );
}

/** True when a PV has only the advance holding account (no belanja lines yet). */
export function isAdvanceOnlyCashBookPvLines(
  lines: Array<{ accountCode: string }>
): boolean {
  if (lines.length === 0) return false;
  return lines.every(
    (line) => line.accountCode === DRIVER_VOUCHER_ADVANCE_ACCOUNT_CODE
  );
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCashBookPvAutocountCsv(
  rows: CashBookPvAutocountCsvRow[]
): string {
  const header = CASH_BOOK_PV_AUTOCOUNT_CSV_HEADERS.join(",");
  const body = rows.map((row) =>
    [
      csvEscape(row.docNo),
      csvEscape(row.docDate),
      csvEscape(row.paidTo),
      csvEscape(row.accNo),
      csvEscape(row.accountName),
      csvEscape(row.description),
      row.amount.toFixed(2),
      csvEscape(row.paymentMethod),
    ].join(",")
  );
  return `\uFEFF${[header, ...body].join("\n")}\n`;
}

export async function loadCashBookPvAutocountExport(input?: {
  /** Inclusive YYYY-MM-DD */
  fromDate?: string;
  /** Inclusive YYYY-MM-DD */
  toDate?: string;
}): Promise<{
  rows: CashBookPvAutocountCsvRow[];
  csv: string;
  /** Confirmed MYR PVs still only posting to 3500 (advance not settled). */
  pendingAdvanceCount: number;
}> {
  const where: {
    book: "MYR";
    status: "confirmed";
    voucherDate?: { gte?: Date; lte?: Date };
  } = { book: "MYR", status: "confirmed" };

  if (input?.fromDate || input?.toDate) {
    where.voucherDate = {};
    if (input.fromDate) {
      where.voucherDate.gte = new Date(`${input.fromDate}T00:00:00.000Z`);
    }
    if (input.toDate) {
      where.voucherDate.lte = new Date(`${input.toDate}T00:00:00.000Z`);
    }
  }

  const vouchers = await prisma.cashBookPaymentVoucher.findMany({
    where,
    include: { lines: { orderBy: { lineOrder: "asc" } } },
    orderBy: [{ voucherDate: "asc" }, { voucherNo: "asc" }],
  });

  let pendingAdvanceCount = 0;
  const rows: CashBookPvAutocountCsvRow[] = [];

  for (const voucher of vouchers) {
    if (isAdvanceOnlyCashBookPvLines(voucher.lines)) {
      pendingAdvanceCount += 1;
    }
    const exportLines = filterCashBookPvLinesForAutocountExport(voucher.lines);
    for (const line of exportLines) {
      rows.push({
        docNo: voucher.voucherNo,
        docDate: toDateInputValue(voucher.voucherDate),
        paidTo: voucher.paidTo,
        accNo: line.accountCode,
        accountName: line.accountName,
        description: line.particulars ?? "",
        amount: decimalToNumber(line.amount) ?? 0,
        paymentMethod: voucher.paymentMethod,
      });
    }
  }

  return {
    rows,
    csv: buildCashBookPvAutocountCsv(rows),
    pendingAdvanceCount,
  };
}
