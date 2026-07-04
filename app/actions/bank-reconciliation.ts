"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  canViewInvoiceCollections,
  canWriteInvoiceCollections,
} from "@/lib/auth-roles";
import {
  buildBankReconciliationCsv,
  defaultBankReconciliationMonthRange,
  loadPaymentsForBankReconciliation,
  type BankReconciliationData,
} from "@/lib/bank-reconciliation";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/types";

async function requireViewer() {
  const user = await getCurrentUser();
  if (!user || !canViewInvoiceCollections(user.role as UserRole)) {
    throw new Error("无权限查看银行对账 Unauthorized");
  }
  return user;
}

async function requireWriter() {
  const user = await getCurrentUser();
  if (!user || !canWriteInvoiceCollections(user.role as UserRole)) {
    throw new Error("无权限标记对账 Unauthorized");
  }
  return user;
}

function assertDateInput(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`无效${label} Invalid ${label}`);
  }
}

export async function getBankReconciliationPageData(input?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<
  BankReconciliationData & {
    canWrite: boolean;
  }
> {
  const user = await requireViewer();
  const defaults = defaultBankReconciliationMonthRange();
  const dateFrom = input?.dateFrom?.trim() || defaults.dateFrom;
  const dateTo = input?.dateTo?.trim() || defaults.dateTo;
  assertDateInput(dateFrom, "起始日期");
  assertDateInput(dateTo, "结束日期");

  const data = await loadPaymentsForBankReconciliation(dateFrom, dateTo);
  return {
    ...data,
    canWrite: canWriteInvoiceCollections(user.role as UserRole),
  };
}

export async function setInvoicePaymentReconciled(input: {
  paymentId: string;
  isReconciled: boolean;
}) {
  const user = await requireWriter();
  const paymentId = input.paymentId?.trim();
  if (!paymentId) throw new Error("无效收款记录 Invalid payment");

  await prisma.invoicePayment.update({
    where: { id: paymentId },
    data: input.isReconciled
      ? {
          isReconciled: true,
          reconciledAt: new Date(),
          reconciledBy: user.id,
          updatedBy: user.id,
        }
      : {
          isReconciled: false,
          reconciledAt: null,
          reconciledBy: null,
          updatedBy: user.id,
        },
  });

  revalidatePath("/financial/bank-reconciliation");
  revalidatePath("/financial/invoice-collections");
  return { ok: true as const };
}

export async function exportBankReconciliationCsv(input: {
  dateFrom: string;
  dateTo: string;
}): Promise<{ filename: string; csv: string }> {
  await requireViewer();
  assertDateInput(input.dateFrom, "起始日期");
  assertDateInput(input.dateTo, "结束日期");

  const data = await loadPaymentsForBankReconciliation(
    input.dateFrom,
    input.dateTo
  );
  const csv = buildBankReconciliationCsv(data);
  const filename = `bank-reconciliation_${input.dateFrom}_${input.dateTo}.csv`;
  return { filename, csv };
}
