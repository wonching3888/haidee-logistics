"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { canAccessCashBook, canWriteCashBook } from "@/lib/auth-roles";
import { nextPaymentVoucherNo } from "@/lib/cash-book/payment-voucher-no";
import {
  assertCashBookLedger,
  normalizePaymentVoucherLines,
  parsePaymentVoucherMethod,
  PaymentVoucherValidationError,
  sumPaymentVoucherLines,
  validateChequeFields,
  type PaymentVoucherLineInput,
} from "@/lib/cash-book/payment-voucher-lines";
import type { CashBookLedger } from "@/lib/constants/cash-book-accounts";
import { parseDateInput, toDateInputValue } from "@/lib/date-utils";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const voucherWithLines = {
  include: { lines: { orderBy: { lineOrder: "asc" as const } } },
} satisfies Prisma.CashBookPaymentVoucherDefaultArgs;

type PaymentVoucherWithLines = Prisma.CashBookPaymentVoucherGetPayload<
  typeof voucherWithLines
>;

const REVALIDATE_PATHS = [
  "/financial/cash-book/payment-voucher",
  "/financial/cash-book/payment-voucher/new",
  "/financial/cash-book/ledger/thb",
  "/financial/cash-book/ledger/myr",
];

function revalidatePaymentVoucher(id?: string) {
  if (process.env.BACKFILL_SKIP_REVALIDATE === "1") return;
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path);
  }
  if (id) {
    revalidatePath(`/financial/cash-book/payment-voucher/${id}`);
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

export interface PaymentVoucherLineRow {
  id: string;
  lineOrder: number;
  accountCode: string;
  accountName: string;
  particulars: string | null;
  amount: number;
}

export interface PaymentVoucherDetail {
  id: string;
  voucherNo: string;
  book: CashBookLedger;
  voucherDate: string;
  paidTo: string;
  paymentMethod: string;
  checkNo: string | null;
  checkDate: string | null;
  dueDate: string | null;
  status: string;
  confirmedAt: string | null;
  payeeSignature: string | null;
  preparedBy: string | null;
  approvedBy: string | null;
  totalAmount: number;
  lines: PaymentVoucherLineRow[];
}

function mapVoucher(row: PaymentVoucherWithLines | null): PaymentVoucherDetail | null {
  if (!row) return null;
  return {
    id: row.id,
    voucherNo: row.voucherNo,
    book: row.book as CashBookLedger,
    voucherDate: toDateInputValue(row.voucherDate),
    paidTo: row.paidTo,
    paymentMethod: row.paymentMethod,
    checkNo: row.checkNo,
    checkDate: row.checkDate ? toDateInputValue(row.checkDate) : null,
    dueDate: row.dueDate ? toDateInputValue(row.dueDate) : null,
    status: row.status,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    payeeSignature: row.payeeSignature,
    preparedBy: row.preparedBy,
    approvedBy: row.approvedBy,
    totalAmount: decimalToNumber(row.totalAmount) ?? 0,
    lines: row.lines.map((line) => ({
      id: line.id,
      lineOrder: line.lineOrder,
      accountCode: line.accountCode,
      accountName: line.accountName,
      particulars: line.particulars,
      amount: decimalToNumber(line.amount) ?? 0,
    })),
  };
}

export async function listPaymentVouchers(input?: {
  book?: CashBookLedger;
  limit?: number;
}): Promise<PaymentVoucherDetail[]> {
  await requireCashBookRead();
  const rows = await prisma.cashBookPaymentVoucher.findMany({
    where: input?.book ? { book: input.book } : undefined,
    orderBy: [{ voucherDate: "desc" }, { voucherNo: "desc" }],
    take: input?.limit ?? 50,
    ...voucherWithLines,
  });
  return rows
    .map((row) => mapVoucher(row))
    .filter((row): row is PaymentVoucherDetail => row !== null);
}

export async function getPaymentVoucher(
  id: string
): Promise<PaymentVoucherDetail | null> {
  await requireCashBookRead();
  const row = await prisma.cashBookPaymentVoucher.findUnique({
    where: { id },
    ...voucherWithLines,
  });
  return mapVoucher(row);
}

export async function previewNextPaymentVoucherNo(
  voucherDateInput: string
): Promise<string> {
  await requireCashBookRead();
  const date = parseDateInput(voucherDateInput);
  return nextPaymentVoucherNo(date);
}

export async function savePaymentVoucher(input: {
  id?: string;
  book: string;
  voucherDate: string;
  paidTo: string;
  paymentMethod: string;
  checkNo?: string | null;
  checkDate?: string | null;
  dueDate?: string | null;
  confirmed: boolean;
  payeeSignature?: string | null;
  preparedBy?: string | null;
  approvedBy?: string | null;
  lines: PaymentVoucherLineInput[];
}) {
  const user = await requireCashBookWrite();
  const book = assertCashBookLedger(input.book);
  const voucherDate = parseDateInput(input.voucherDate);
  const paidTo = input.paidTo.trim();
  if (!paidTo) throw new PaymentVoucherValidationError("付款对象不能为空");

  const paymentMethod = parsePaymentVoucherMethod(input.paymentMethod);
  validateChequeFields({
    paymentMethod,
    checkNo: input.checkNo,
    checkDate: input.checkDate,
  });

  const normalizedLines = normalizePaymentVoucherLines(book, input.lines);
  const totalAmount = sumPaymentVoucherLines(normalizedLines);
  const status = input.confirmed ? "confirmed" : "draft";
  const checkNo =
    paymentMethod === "CHEQUE" ? input.checkNo?.trim() || null : null;
  const checkDate =
    paymentMethod === "CHEQUE" && input.checkDate
      ? parseDateInput(input.checkDate)
      : null;
  const dueDate = input.dueDate?.trim()
    ? parseDateInput(input.dueDate)
    : null;

  const signatureData = {
    payeeSignature: input.payeeSignature?.trim() || null,
    preparedBy: input.preparedBy?.trim() || null,
    approvedBy: input.approvedBy?.trim() || null,
  };

  if (input.id) {
    const existing = await prisma.cashBookPaymentVoucher.findUnique({
      where: { id: input.id },
    });
    if (!existing) throw new Error("凭证不存在");

    const confirmingNow =
      status === "confirmed" && existing.status !== "confirmed";
    await prisma.$transaction(async (tx) => {
      await tx.cashBookPaymentVoucher.update({
        where: { id: input.id },
        data: {
          book,
          voucherDate,
          paidTo,
          paymentMethod,
          checkNo,
          checkDate,
          dueDate,
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
          totalAmount,
          ...signatureData,
        },
      });
      await tx.cashBookPaymentVoucherLine.deleteMany({
        where: { voucherId: input.id },
      });
      await tx.cashBookPaymentVoucherLine.createMany({
        data: normalizedLines.map((line, index) => ({
          id: randomUUID(),
          voucherId: input.id!,
          lineOrder: index,
          accountCode: line.accountCode,
          accountName: line.accountName,
          particulars: line.particulars,
          amount: line.amount,
        })),
      });
    });

    revalidatePaymentVoucher(input.id);
    return getPaymentVoucher(input.id);
  }

  const voucherNo = await nextPaymentVoucherNo(voucherDate);
  const id = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.cashBookPaymentVoucher.create({
      data: {
        id,
        voucherNo,
        book,
        voucherDate,
        paidTo,
        paymentMethod,
        checkNo,
        checkDate,
        dueDate,
        status,
        confirmedAt: status === "confirmed" ? new Date() : null,
        confirmedBy: status === "confirmed" ? user.id : null,
        totalAmount,
        createdBy: user.id,
        ...signatureData,
        lines: {
          create: normalizedLines.map((line, index) => ({
            id: randomUUID(),
            lineOrder: index,
            accountCode: line.accountCode,
            accountName: line.accountName,
            particulars: line.particulars,
            amount: line.amount,
          })),
        },
      },
    });
  });

  revalidatePaymentVoucher(id);
  return getPaymentVoucher(id);
}

export async function deletePaymentVoucher(id: string) {
  await requireCashBookWrite();
  await prisma.cashBookPaymentVoucher.delete({ where: { id } });
  revalidatePaymentVoucher();
}
