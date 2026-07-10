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
}

function mapReceipt(
  row: Awaited<ReturnType<typeof prisma.cashBookReceiptVoucher.findUnique>>
): ReceiptVoucherDetail | null {
  if (!row) return null;
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
  const row = await prisma.cashBookReceiptVoucher.findUnique({ where: { id } });
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

  if (input.id) {
    const existing = await prisma.cashBookReceiptVoucher.findUnique({
      where: { id: input.id },
    });
    if (!existing) throw new Error("凭证不存在");

    const confirmingNow =
      status === "confirmed" && existing.status !== "confirmed";
    await prisma.cashBookReceiptVoucher.update({
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
    revalidateReceipt(input.id);
    return getReceiptVoucher(input.id);
  }

  const voucherNo = await nextReceiptVoucherNo(voucherDate);
  const id = randomUUID();
  await prisma.cashBookReceiptVoucher.create({
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
    },
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
