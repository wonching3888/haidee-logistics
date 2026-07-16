"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { canAccessCashBook, canWriteCashBook } from "@/lib/auth-roles";
import { nextReceiptVoucherNo } from "@/lib/cash-book/receipt-voucher-no";
import {
  normalizeReceiptVoucherInput,
  ReceiptVoucherValidationError,
} from "@/lib/cash-book/receipt-voucher";
import type { CashBookLedger } from "@/lib/constants/cash-book-accounts";
import { parseDateInput, toDateInputValue } from "@/lib/date-utils";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";

const REVALIDATE_PATHS = [
  "/financial/cash-book/receipt-voucher",
  "/financial/cash-book/receipt-voucher/new",
  "/financial/cash-book/ledger/thb",
  "/financial/cash-book/ledger/myr",
];

function revalidateReceipt(id?: string) {
  if (process.env.BACKFILL_SKIP_REVALIDATE === "1") return;
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path);
  }
  if (id) {
    revalidatePath(`/financial/cash-book/receipt-voucher/${id}`);
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

export interface ReceiptVoucherLineRow {
  id: string;
  lineOrder: number;
  accountCode: string;
  accountName: string;
  particulars: string | null;
  amount: number;
}

export interface ReceiptVoucherDetail {
  id: string;
  voucherNo: string;
  book: CashBookLedger;
  voucherDate: string;
  receivedFrom: string;
  accountCode: string;
  accountName: string;
  amount: number;
  notes: string | null;
  status: string;
  confirmedAt: string | null;
  preparedBy: string | null;
  approvedBy: string | null;
  lines: ReceiptVoucherLineRow[];
}

type ReceiptRow =
  | Awaited<ReturnType<typeof prisma.cashBookReceiptVoucher.findUnique>>
  | (NonNullable<
      Awaited<ReturnType<typeof prisma.cashBookReceiptVoucher.findUnique>>
    > & {
      lines?: Array<{
        id: string;
        lineOrder: number;
        accountCode: string;
        accountName: string;
        particulars: string | null;
        amount: unknown;
      }>;
    });

function mapReceipt(row: ReceiptRow): ReceiptVoucherDetail | null {
  if (!row) return null;
  const lines = "lines" in row && Array.isArray(row.lines) ? row.lines : [];
  return {
    id: row.id,
    voucherNo: row.voucherNo,
    book: row.book as CashBookLedger,
    voucherDate: toDateInputValue(row.voucherDate),
    receivedFrom: row.receivedFrom,
    accountCode: row.accountCode,
    accountName: row.accountName,
    amount: decimalToNumber(row.amount) ?? 0,
    notes: row.notes,
    status: row.status,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    preparedBy: row.preparedBy,
    approvedBy: row.approvedBy,
    lines: lines.map((line) => ({
      id: line.id,
      lineOrder: line.lineOrder,
      accountCode: line.accountCode,
      accountName: line.accountName,
      particulars: line.particulars,
      amount: decimalToNumber(line.amount) ?? 0,
    })),
  };
}

export async function listReceiptVouchers(input?: {
  book?: CashBookLedger;
  limit?: number;
}): Promise<ReceiptVoucherDetail[]> {
  await requireCashBookRead();
  const rows = await prisma.cashBookReceiptVoucher.findMany({
    where: input?.book ? { book: input.book } : undefined,
    orderBy: [{ voucherDate: "desc" }, { voucherNo: "desc" }],
    take: input?.limit ?? 50,
  });
  return rows
    .map((row) => mapReceipt(row))
    .filter((row): row is ReceiptVoucherDetail => row !== null);
}

export async function getReceiptVoucher(
  id: string
): Promise<ReceiptVoucherDetail | null> {
  await requireCashBookRead();
  const row = await prisma.cashBookReceiptVoucher.findUnique({
    where: { id },
    include: { lines: { orderBy: { lineOrder: "asc" } } },
  });
  return mapReceipt(row);
}

export async function previewNextReceiptVoucherNo(
  voucherDateInput: string
): Promise<string> {
  await requireCashBookRead();
  return nextReceiptVoucherNo(parseDateInput(voucherDateInput));
}

export async function saveReceiptVoucher(input: {
  id?: string;
  book: string;
  voucherDate: string;
  receivedFrom: string;
  accountCode: string;
  amount: number;
  notes?: string | null;
  confirmed: boolean;
  preparedBy?: string | null;
  approvedBy?: string | null;
}) {
  const user = await requireCashBookWrite();
  const normalized = normalizeReceiptVoucherInput(input);
  const voucherDate = parseDateInput(input.voucherDate);
  const status = input.confirmed ? "confirmed" : "draft";
  const signatureData = {
    preparedBy: input.preparedBy?.trim() || null,
    approvedBy: input.approvedBy?.trim() || null,
  };
  const lineData = {
    id: randomUUID(),
    lineOrder: normalized.line.lineOrder,
    accountCode: normalized.line.accountCode,
    accountName: normalized.line.accountName,
    particulars: normalized.line.particulars,
    amount: normalized.line.amount,
  };

  if (input.id) {
    const existing = await prisma.cashBookReceiptVoucher.findUnique({
      where: { id: input.id },
    });
    if (!existing) throw new Error("凭证不存在");

    const confirmingNow =
      status === "confirmed" && existing.status !== "confirmed";

    await prisma.$transaction(async (tx) => {
      await tx.cashBookReceiptVoucher.update({
        where: { id: input.id },
        data: {
          book: normalized.book,
          voucherDate,
          receivedFrom: normalized.receivedFrom,
          accountCode: normalized.accountCode,
          accountName: normalized.accountName,
          amount: normalized.amount,
          notes: normalized.notes,
          status,
          confirmedAt:
            status === "confirmed"
              ? confirmingNow
                ? new Date()
                : existing.confirmedAt
              : null,
          confirmedBy:
            status === "confirmed"
              ? confirmingNow
                ? user.id
                : existing.confirmedBy
              : null,
          ...signatureData,
        },
      });
      await tx.cashBookReceiptVoucherLine.deleteMany({
        where: { voucherId: input.id! },
      });
      await tx.cashBookReceiptVoucherLine.create({
        data: {
          ...lineData,
          voucherId: input.id!,
        },
      });
    });
    revalidateReceipt(input.id);
    return getReceiptVoucher(input.id);
  }

  const voucherNo = await nextReceiptVoucherNo(voucherDate);
  const id = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.cashBookReceiptVoucher.create({
      data: {
        id,
        voucherNo,
        book: normalized.book,
        voucherDate,
        receivedFrom: normalized.receivedFrom,
        accountCode: normalized.accountCode,
        accountName: normalized.accountName,
        amount: normalized.amount,
        notes: normalized.notes,
        status,
        confirmedAt: status === "confirmed" ? new Date() : null,
        confirmedBy: status === "confirmed" ? user.id : null,
        createdBy: user.id,
        ...signatureData,
        lines: {
          create: [lineData],
        },
      },
    });
  });
  revalidateReceipt(id);
  return getReceiptVoucher(id);
}

export async function deleteReceiptVoucher(id: string) {
  await requireCashBookWrite();
  await prisma.cashBookReceiptVoucher.delete({ where: { id } });
  revalidateReceipt();
}

export { ReceiptVoucherValidationError };
