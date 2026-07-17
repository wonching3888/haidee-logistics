"use server";

import { format } from "date-fns";
import { getCurrentUser } from "@/lib/auth";
import { canAccessCashBook } from "@/lib/auth-roles";
import { getCashBookLedger } from "@/app/actions/cash-book-ledger";
import {
  sliceCashBookLedgerStatement,
  type CashBookLedgerDisplayRow,
} from "@/lib/cash-book/ledger";
import { buildCashBookLedgerCsv } from "@/lib/cash-book/ledger-csv";
import { assertCashBookLedger } from "@/lib/cash-book/payment-voucher-lines";
import type { CashBookLedger } from "@/lib/constants/cash-book-accounts";
import { formatInvoicePeriodLabel } from "@/lib/constants/monthly-invoice";

async function requireCashBookRead() {
  const user = await getCurrentUser();
  if (!user || !canAccessCashBook(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}
// 注意：用 canAccessCashBook（跟查看账本页面同一个权限），不要误用
// CashBookPvAutocountExportPanel 那边的 canAccessAutocountExport——那是不相关的
// AutoCount 导出权限。

function resolveUserIdLabel(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return "—";
  return user.email?.trim() || user.id;
}
// 与 app/actions/ar-invoice-listing.ts 里的 resolveUserIdLabel 保持同样写法

function monthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export interface CashBookLedgerStatementPrintData {
  book: CashBookLedger;
  year: number;
  month: number;
  periodLabel: string;
  generatedAtLabel: string;
  userIdLabel: string;
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  rows: CashBookLedgerDisplayRow[];
}

export async function getCashBookLedgerStatement(input: {
  book: string;
  year: number;
  month: number;
}): Promise<CashBookLedgerStatementPrintData> {
  const user = await requireCashBookRead();
  const book = assertCashBookLedger(input.book);
  const ledger = await getCashBookLedger(book);
  const range = monthRange(input.year, input.month);
  const statement = sliceCashBookLedgerStatement(ledger.rows, range);

  return {
    book,
    year: input.year,
    month: input.month,
    periodLabel: formatInvoicePeriodLabel(input.year, input.month),
    generatedAtLabel: format(new Date(), "dd/MM/yyyy HH:mm:ss"),
    userIdLabel: resolveUserIdLabel(user),
    openingBalance: statement.openingBalance,
    closingBalance: statement.closingBalance,
    totalDebit: statement.totalDebit,
    totalCredit: statement.totalCredit,
    rows: statement.rows,
  };
}

export async function exportCashBookLedgerCsvAction(input: {
  book: string;
  fromDate: string;
  toDate: string;
}): Promise<{ ok: true; csv: string; filename: string; rowCount: number }> {
  await requireCashBookRead();
  const book = assertCashBookLedger(input.book);
  const ledger = await getCashBookLedger(book);
  const statement = sliceCashBookLedgerStatement(ledger.rows, {
    from: input.fromDate,
    to: input.toDate,
  });
  const csv = buildCashBookLedgerCsv(book, statement);

  return {
    ok: true,
    csv,
    filename: `cash-book-ledger-${book.toLowerCase()}-${input.fromDate}_${input.toDate}.csv`,
    rowCount: statement.rows.length,
  };
}
