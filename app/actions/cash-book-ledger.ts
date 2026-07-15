"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { canAccessCashBook, canWriteCashBook } from "@/lib/auth-roles";
import {
  buildCashBookLedgerRows,
  formatCashBookLedgerDescription,
  type CashBookLedgerDisplayRow,
  type CashBookLedgerSourceRow,
} from "@/lib/cash-book/ledger";
import { assertCashBookLedger } from "@/lib/cash-book/payment-voucher-lines";
import type { CashBookLedger } from "@/lib/constants/cash-book-accounts";
import { toDateInputValue } from "@/lib/date-utils";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";

const LEDGER_PATHS = [
  "/financial/cash-book/ledger/thb",
  "/financial/cash-book/ledger/myr",
];

function revalidateLedgers() {
  if (process.env.BACKFILL_SKIP_REVALIDATE === "1") return;
  for (const path of LEDGER_PATHS) {
    revalidatePath(path);
  }
}

async function requireCashBookRead() {
  const user = await getCurrentUser();
  if (!user || !canAccessCashBook(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

async function requireCashBookWrite() {
  const user = await requireCashBookRead();
  if (!canWriteCashBook(user.role)) {
    throw new Error("无写入权限 Unauthorized");
  }
  return user;
}

export interface OpeningBalanceAdjustmentRow {
  id: string;
  book: CashBookLedger;
  previousAmount: number;
  newAmount: number;
  notes: string;
  createdAt: string;
  createdBy: string;
}

export async function getCashBookOpeningBalance(
  bookInput: string
): Promise<number> {
  await requireCashBookRead();
  const book = assertCashBookLedger(bookInput);
  const latest = await prisma.cashBookOpeningBalanceAdjustment.findFirst({
    where: { book },
    orderBy: { createdAt: "desc" },
  });
  return latest ? (decimalToNumber(latest.newAmount) ?? 0) : 0;
}

export async function listOpeningBalanceAdjustments(
  bookInput: string
): Promise<OpeningBalanceAdjustmentRow[]> {
  await requireCashBookRead();
  const book = assertCashBookLedger(bookInput);
  const rows = await prisma.cashBookOpeningBalanceAdjustment.findMany({
    where: { book },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.map((row) => ({
    id: row.id,
    book: row.book as CashBookLedger,
    previousAmount: decimalToNumber(row.previousAmount) ?? 0,
    newAmount: decimalToNumber(row.newAmount) ?? 0,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
  }));
}

/**
 * Set opening balance via audited adjustment (not a bare UPDATE).
 * Default books start at 0 until the first adjustment.
 */
export async function adjustCashBookOpeningBalance(input: {
  book: string;
  newAmount: number;
  notes: string;
}): Promise<OpeningBalanceAdjustmentRow> {
  const user = await requireCashBookWrite();
  const book = assertCashBookLedger(input.book);
  const notes = input.notes.trim();
  if (!notes) throw new Error("期初余额调整必须填写说明（留痕）");
  const newAmount = Math.round(Number(input.newAmount) * 100) / 100;
  if (!Number.isFinite(newAmount)) throw new Error("期初余额金额无效");

  const latest = await prisma.cashBookOpeningBalanceAdjustment.findFirst({
    where: { book },
    orderBy: { createdAt: "desc" },
  });
  const previousAmount = latest
    ? (decimalToNumber(latest.newAmount) ?? 0)
    : 0;
  const id = randomUUID();
  const row = await prisma.cashBookOpeningBalanceAdjustment.create({
    data: {
      id,
      book,
      previousAmount,
      newAmount,
      notes,
      createdBy: user.id,
    },
  });
  revalidateLedgers();
  return {
    id: row.id,
    book: row.book as CashBookLedger,
    previousAmount: decimalToNumber(row.previousAmount) ?? 0,
    newAmount: decimalToNumber(row.newAmount) ?? 0,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
  };
}

export async function getCashBookLedger(
  bookInput: string
): Promise<{
  book: CashBookLedger;
  openingBalance: number;
  rows: CashBookLedgerDisplayRow[];
}> {
  await requireCashBookRead();
  const book = assertCashBookLedger(bookInput);
  const openingBalance = await getCashBookOpeningBalance(book);

  const [payments, receipts] = await Promise.all([
    prisma.cashBookPaymentVoucher.findMany({
      where: { book, status: "confirmed" },
      include: { lines: { orderBy: { lineOrder: "asc" }, take: 1 } },
      orderBy: [{ voucherDate: "asc" }, { voucherNo: "asc" }],
    }),
    prisma.cashBookReceiptVoucher.findMany({
      where: { book, status: "confirmed" },
      orderBy: [{ voucherDate: "asc" }, { voucherNo: "asc" }],
    }),
  ]);

  const sourceRows: CashBookLedgerSourceRow[] = [
    ...payments.map((p) => ({
      kind: "payment" as const,
      id: p.id,
      voucherNo: p.voucherNo,
      voucherDate: toDateInputValue(p.voucherDate),
      description: formatCashBookLedgerDescription(
        p.paidTo,
        p.lines[0]?.particulars
      ),
      amount: decimalToNumber(p.totalAmount) ?? 0,
      sortKey: (p.confirmedAt ?? p.createdAt).toISOString(),
    })),
    ...receipts.map((r) => ({
      kind: "receipt" as const,
      id: r.id,
      voucherNo: r.voucherNo,
      voucherDate: toDateInputValue(r.voucherDate),
      description: formatCashBookLedgerDescription(r.receivedFrom, r.notes),
      amount: decimalToNumber(r.amount) ?? 0,
      sortKey: (r.confirmedAt ?? r.createdAt).toISOString(),
    })),
  ];

  return {
    book,
    openingBalance,
    rows: buildCashBookLedgerRows({ book, openingBalance, sourceRows }),
  };
}
