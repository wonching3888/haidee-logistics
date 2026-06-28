"use server";

import { getCurrentUser } from "@/lib/auth";
import { canWriteInvoiceCollections } from "@/lib/auth-roles";
import {
  bankAccountsForCurrency,
  inferDefaultBankAccount,
  isBankAccountValidForCurrency,
  isInvoiceBankAccount,
} from "@/lib/constants/invoice-bank-accounts";
import {
  formatAllocationPreviewRows,
  loadReceivableInvoicesForCustomerLedger,
  previewAutoAllocationForNewPayment,
  runAutoAllocation,
  type InvoicePaymentView,
  type ReceivableInvoiceWithCollection,
} from "@/lib/invoice-allocation";
import { prisma } from "@/lib/prisma";
import {
  parseReceivableCustomerKey,
  type ReceivableCurrency,
  type ReceivableCustomerKind,
} from "@/lib/receivable-invoices";
import type { UserRole } from "@/types";
import { randomUUID } from "node:crypto";

async function requireInvoiceCollectionsWriter() {
  const user = await getCurrentUser();
  if (!user || !canWriteInvoiceCollections(user.role as UserRole)) {
    throw new Error("无权限录入来款 Unauthorized");
  }
  return user;
}

function parseCurrency(value: string): ReceivableCurrency {
  if (value === "THB" || value === "MYR") return value;
  throw new Error("无效币种 Invalid currency");
}

function parseCustomerKind(value: string): ReceivableCustomerKind {
  if (value === "shipper" || value === "consignee" || value === "charter_manual") {
    return value;
  }
  throw new Error("无效客户类型 Invalid customer kind");
}

function parsePaymentDate(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("无效付款日期 Invalid payment date");
  }
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("无效付款日期 Invalid payment date");
  }
  return date;
}

function parseAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("来款金额须大于 0 Amount must be greater than zero");
  }
  return Math.round(value * 100) / 100;
}

export async function getDefaultBankAccountForLedger(input: {
  customerKey: string;
  currency: string;
}) {
  await requireInvoiceCollectionsWriter();
  const currency = parseCurrency(input.currency);
  parseReceivableCustomerKey(input.customerKey);

  const invoices = await loadReceivableInvoicesForCustomerLedger(
    input.customerKey,
    currency
  );
  const issuerKey = invoices[0]?.issuerKey ?? null;

  return {
    defaultBankAccount: inferDefaultBankAccount({ currency, issuerKey }),
    bankAccounts: bankAccountsForCurrency(currency),
  };
}

export async function previewInvoicePaymentAllocation(input: {
  customerKey: string;
  customerKind: string;
  currency: string;
  amount: number;
  paymentDate: string;
}) {
  await requireInvoiceCollectionsWriter();
  const currency = parseCurrency(input.currency);
  parseReceivableCustomerKey(input.customerKey);
  parseCustomerKind(input.customerKind);
  const amount = parseAmount(input.amount);
  const paymentDate = parsePaymentDate(input.paymentDate);

  const invoices = await loadReceivableInvoicesForCustomerLedger(
    input.customerKey,
    currency
  );

  const previewPaymentId = "__preview__";
  const result = await previewAutoAllocationForNewPayment({
    customerKey: input.customerKey,
    currency,
    newPayment: {
      id: previewPaymentId,
      amount,
      paymentDate: paymentDate.toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    },
  });

  return {
    allocations: formatAllocationPreviewRows(
      result,
      invoices,
      previewPaymentId
    ),
    unallocatedAmount: result.paymentUnallocated[previewPaymentId] ?? 0,
    openInvoices: invoices.map((invoice) => ({
      invoiceKey: invoice.invoiceKey,
      invoiceType: invoice.invoiceType,
      invoiceNo: invoice.invoiceNo,
      yearMonth: invoice.yearMonth,
      totalAmount: invoice.totalAmount,
    })),
  };
}

export async function createInvoicePayment(input: {
  customerKey: string;
  customerKind: string;
  customerId?: string | null;
  currency: string;
  amount: number;
  paymentDate: string;
  bankAccount: string;
  notes?: string | null;
}) {
  const user = await requireInvoiceCollectionsWriter();
  const currency = parseCurrency(input.currency);
  const customerKind = parseCustomerKind(input.customerKind);
  parseReceivableCustomerKey(input.customerKey);
  const amount = parseAmount(input.amount);
  const paymentDate = parsePaymentDate(input.paymentDate);

  if (!isInvoiceBankAccount(input.bankAccount)) {
    throw new Error("无效户口 Invalid bank account");
  }
  if (!isBankAccountValidForCurrency(input.bankAccount, currency)) {
    throw new Error("户口与币种不匹配 Bank account does not match currency");
  }

  const notes = input.notes?.trim() || null;

  const created = await prisma.$transaction(async (tx) => {
    const payment = await tx.invoicePayment.create({
      data: {
        customerKey: input.customerKey,
        customerKind,
        customerId: input.customerId ?? null,
        currency,
        amount,
        paymentDate,
        bankAccount: input.bankAccount,
        notes,
        allocationStrategy: "auto",
        unallocatedAmount: amount,
        createdBy: user.id,
      },
    });

    await runAutoAllocation(input.customerKey, currency, tx);

    return tx.invoicePayment.findUniqueOrThrow({
      where: { id: payment.id },
      include: {
        allocations: {
          orderBy: [{ yearMonth: "asc" }, { invoiceKey: "asc" }],
        },
      },
    });
  });

  return {
    paymentId: created.id,
    amount: Number(created.amount),
    unallocatedAmount: Number(created.unallocatedAmount),
    allocations: created.allocations.map((row) => ({
      invoiceType: row.invoiceType,
      invoiceKey: row.invoiceKey,
      yearMonth: row.yearMonth,
      amount: Number(row.amount),
      isManual: row.isManual,
    })),
  };
}

export type CreateInvoicePaymentResult = Awaited<
  ReturnType<typeof createInvoicePayment>
>;

export type PreviewInvoicePaymentAllocationResult = Awaited<
  ReturnType<typeof previewInvoicePaymentAllocation>
>;

export type InvoiceCollectionsDetailPayment = InvoicePaymentView;
export type InvoiceCollectionsDetailInvoice = ReceivableInvoiceWithCollection;

/** Test-only helper for permission checks without DB writes. */
export async function assertInvoiceCollectionsWriteAccess() {
  await requireInvoiceCollectionsWriter();
  return { ok: true as const, nonce: randomUUID() };
}
