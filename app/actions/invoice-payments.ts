"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { canWriteInvoiceCollections } from "@/lib/auth-roles";
import {
  bankAccountsForCurrency,
  inferDefaultBankAccount,
  isBankAccountValidForCurrency,
  isInvoiceBankAccount,
} from "@/lib/constants/invoice-bank-accounts";
import {
  applyManualAllocationsForPayment,
  formatAllocationPreviewRows,
  loadAllocatedAmountsForInvoices,
  loadReceivableInvoicesForCustomerLedger,
  previewAutoAllocationForNewPayment,
  resetPaymentToAutoAllocation,
  rerunAutoAllocationForLedgers,
  runAutoAllocation,
  validateManualAllocationRows,
  type InvoicePaymentView,
  type ManualAllocationRowInput,
  type ReceivableInvoiceWithCollection,
} from "@/lib/invoice-allocation";
import {
  allocationRowsFromDb,
  appendInvoicePaymentChangeLogs,
  buildInvoicePaymentAllocationMetadata,
  buildInvoicePaymentCreateMetadata,
  buildInvoicePaymentDeleteMetadata,
  diffInvoicePaymentFieldChanges,
  summarizeAllocations,
} from "@/lib/invoice-payment-audit";
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

async function resolveCustomerName(
  customerKey: string,
  currency: ReceivableCurrency
) {
  const invoices = await loadReceivableInvoicesForCustomerLedger(
    customerKey,
    currency
  );
  return invoices[0]?.customerName ?? null;
}

function allocationSummaryChanged(
  before: ReturnType<typeof allocationRowsFromDb>,
  after: ReturnType<typeof allocationRowsFromDb>
) {
  if (before.length !== after.length) return true;
  const key = (row: (typeof before)[number]) =>
    `${row.invoiceType}|${row.invoiceKey}|${row.amount}|${row.isManual ? 1 : 0}`;
  const beforeKeys = before.map(key).sort().join(",");
  const afterKeys = after.map(key).sort().join(",");
  return beforeKeys !== afterKeys;
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
  const paymentDateStr = input.paymentDate.trim();

  if (!isInvoiceBankAccount(input.bankAccount)) {
    throw new Error("无效户口 Invalid bank account");
  }
  if (!isBankAccountValidForCurrency(input.bankAccount, currency)) {
    throw new Error("户口与币种不匹配 Bank account does not match currency");
  }

  const notes = input.notes?.trim() || null;
  const customerName = await resolveCustomerName(input.customerKey, currency);

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

    const refreshed = await tx.invoicePayment.findUniqueOrThrow({
      where: { id: payment.id },
      include: {
        allocations: {
          orderBy: [{ yearMonth: "asc" }, { invoiceKey: "asc" }],
        },
      },
    });

    await appendInvoicePaymentChangeLogs(tx, {
      actorUserId: user.id,
      logs: [
        {
          paymentId: payment.id,
          customerKey: input.customerKey,
          currency,
          eventType: "create",
          metadata: buildInvoicePaymentCreateMetadata({
            customerKey: input.customerKey,
            customerKind,
            customerName,
            currency,
            amount,
            paymentDate: paymentDateStr,
            bankAccount: input.bankAccount,
            notes,
            allocationsAfter: allocationRowsFromDb(refreshed.allocations),
            unallocatedAfter: Number(refreshed.unallocatedAmount),
          }),
        },
      ],
    });

    return refreshed;
  });

  revalidatePath("/history");
  revalidatePath("/financial/invoice-collections");

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

export async function deleteInvoicePayment(paymentId: string) {
  const user = await requireInvoiceCollectionsWriter();

  const payment = await prisma.invoicePayment.findUniqueOrThrow({
    where: { id: paymentId },
    select: {
      customerKey: true,
      currency: true,
    },
  });
  const currency = parseCurrency(payment.currency);
  const customerKey = payment.customerKey;
  const customerName = await resolveCustomerName(customerKey, currency);

  await prisma.$transaction(
    async (tx) => {
      const locked = await tx.invoicePayment.findUniqueOrThrow({
        where: { id: paymentId },
        include: {
          allocations: {
            orderBy: [{ yearMonth: "asc" }, { invoiceKey: "asc" }],
          },
        },
      });

      await appendInvoicePaymentChangeLogs(tx, {
        actorUserId: user.id,
        logs: [
          {
            paymentId,
            customerKey,
            currency,
            eventType: "delete",
            metadata: buildInvoicePaymentDeleteMetadata({
              customerKey,
              customerKind: locked.customerKind,
              customerName,
              currency,
              amount: locked.amount,
              paymentDate: locked.paymentDate,
              bankAccount: locked.bankAccount,
              notes: locked.notes,
              allocationsBefore: allocationRowsFromDb(locked.allocations),
              unallocatedBefore: locked.unallocatedAmount,
            }),
          },
        ],
      });

      await tx.invoicePayment.delete({ where: { id: paymentId } });
      await runAutoAllocation(customerKey, currency, tx);
    },
    { timeout: 30_000 }
  );

  revalidatePath("/history");
  revalidatePath("/financial/invoice-collections");

  return { ok: true as const };
}

export async function updateInvoicePayment(input: {
  paymentId: string;
  amount: number;
  paymentDate: string;
  bankAccount: string;
  notes?: string | null;
  customerKey: string;
  customerKind: string;
  customerId?: string | null;
  currency: string;
}) {
  const user = await requireInvoiceCollectionsWriter();
  const amount = parseAmount(input.amount);
  const paymentDate = parsePaymentDate(input.paymentDate);
  const currency = parseCurrency(input.currency);
  const customerKind = parseCustomerKind(input.customerKind);
  parseReceivableCustomerKey(input.customerKey);

  if (!isInvoiceBankAccount(input.bankAccount)) {
    throw new Error("无效户口 Invalid bank account");
  }
  if (!isBankAccountValidForCurrency(input.bankAccount, currency)) {
    throw new Error("户口与币种不匹配 Bank account does not match currency");
  }

  const notes = input.notes?.trim() || null;
  const customerName = await resolveCustomerName(input.customerKey, currency);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.invoicePayment.findUniqueOrThrow({
      where: { id: input.paymentId },
      include: {
        allocations: {
          orderBy: [{ yearMonth: "asc" }, { invoiceKey: "asc" }],
        },
      },
    });

    const beforeAllocations = allocationRowsFromDb(existing.allocations);
    const beforeUnallocated = Number(existing.unallocatedAmount);

    const oldCurrency = parseCurrency(existing.currency);
    const oldCustomerKey = existing.customerKey;

    if (existing.allocationStrategy === "manual") {
      const manualSum = roundMoney(
        existing.allocations
          .filter((row) => row.isManual)
          .reduce((sum, row) => sum + Number(row.amount), 0)
      );
      if (amount + 0.001 < manualSum) {
        throw new Error(
          "来款金额不能低于手动冲账合计 Payment amount cannot be less than manual allocations"
        );
      }
    }

    await tx.invoicePayment.update({
      where: { id: input.paymentId },
      data: {
        amount,
        paymentDate,
        bankAccount: input.bankAccount,
        notes,
        customerKey: input.customerKey,
        customerKind,
        customerId: input.customerId ?? null,
        currency,
        updatedBy: user.id,
      },
    });

    const ledgers = [{ customerKey: oldCustomerKey, currency: oldCurrency }];
    if (oldCustomerKey !== input.customerKey || oldCurrency !== currency) {
      ledgers.push({ customerKey: input.customerKey, currency });
    }

    await rerunAutoAllocationForLedgers(ledgers, tx);

    const refreshed = await tx.invoicePayment.findUniqueOrThrow({
      where: { id: input.paymentId },
      include: {
        allocations: {
          orderBy: [{ yearMonth: "asc" }, { invoiceKey: "asc" }],
        },
      },
    });
    const afterAllocations = allocationRowsFromDb(refreshed.allocations);
    const allocationMetadata = buildInvoicePaymentAllocationMetadata({
      customerKey: input.customerKey,
      customerName,
      currency,
      amount,
      allocationsBefore: beforeAllocations,
      allocationsAfter: afterAllocations,
      unallocatedBefore: beforeUnallocated,
      unallocatedAfter: Number(refreshed.unallocatedAmount),
    });

    const fieldChanges = diffInvoicePaymentFieldChanges(existing, {
      amount,
      paymentDate,
      bankAccount: input.bankAccount,
      notes,
      customerKey: input.customerKey,
      currency,
    });

    const logs: Parameters<typeof appendInvoicePaymentChangeLogs>[1]["logs"] =
      fieldChanges.map((change) => ({
        paymentId: input.paymentId,
        customerKey: input.customerKey,
        currency,
        eventType: "update" as const,
        field: change.field,
        fromValue: change.fromValue,
        toValue: change.toValue,
      }));

    if (
      logs.length === 0 &&
      allocationSummaryChanged(beforeAllocations, afterAllocations)
    ) {
      logs.push({
        paymentId: input.paymentId,
        customerKey: input.customerKey,
        currency,
        eventType: "update",
        field: "allocations",
        fromValue: summarizeAllocations(beforeAllocations),
        toValue: summarizeAllocations(afterAllocations),
      });
    }

    if (logs.length > 0) {
      logs[0].metadata = allocationMetadata;
    }

    await appendInvoicePaymentChangeLogs(tx, {
      actorUserId: user.id,
      logs,
    });
  });

  revalidatePath("/history");
  revalidatePath("/financial/invoice-collections");

  return { ok: true as const };
}

export async function setManualInvoicePaymentAllocation(input: {
  paymentId: string;
  allocations: ManualAllocationRowInput[];
  confirmOverAllocation?: boolean;
}) {
  const user = await requireInvoiceCollectionsWriter();

  await prisma.$transaction(async (tx) => {
    const payment = await tx.invoicePayment.findUniqueOrThrow({
      where: { id: input.paymentId },
    });
    const currency = parseCurrency(payment.currency);
    const customerKey = payment.customerKey;
    const customerName = await resolveCustomerName(customerKey, currency);
    const beforeAllocations = allocationRowsFromDb(
      await tx.invoicePaymentAllocation.findMany({
        where: { paymentId: input.paymentId },
        orderBy: [{ yearMonth: "asc" }, { invoiceKey: "asc" }],
      })
    );
    const beforeUnallocated = Number(payment.unallocatedAmount);

    const invoices = await loadReceivableInvoicesForCustomerLedger(
      customerKey,
      currency
    );
    const allocatedExcludingPayment = await loadAllocatedAmountsForInvoices(
      invoices,
      { excludePaymentId: input.paymentId }
    );

    validateManualAllocationRows({
      paymentAmount: Number(payment.amount),
      currency,
      customerKey,
      allocations: input.allocations,
      invoices,
      allocatedByInvoiceExcludingPayment: allocatedExcludingPayment,
      confirmOverAllocation: input.confirmOverAllocation,
    });

    await applyManualAllocationsForPayment(
      input.paymentId,
      input.allocations,
      invoices,
      tx,
      user.id
    );
    await runAutoAllocation(customerKey, currency, tx);

    const refreshed = await tx.invoicePayment.findUniqueOrThrow({
      where: { id: input.paymentId },
      include: {
        allocations: {
          orderBy: [{ yearMonth: "asc" }, { invoiceKey: "asc" }],
        },
      },
    });

    await appendInvoicePaymentChangeLogs(tx, {
      actorUserId: user.id,
      logs: [
        {
          paymentId: input.paymentId,
          customerKey,
          currency,
          eventType: "manual_override",
          metadata: buildInvoicePaymentAllocationMetadata({
            customerKey,
            customerName,
            currency,
            amount: Number(payment.amount),
            allocationsBefore: beforeAllocations,
            allocationsAfter: allocationRowsFromDb(refreshed.allocations),
            unallocatedBefore: beforeUnallocated,
            unallocatedAfter: Number(refreshed.unallocatedAmount),
          }),
        },
      ],
    });
  });

  revalidatePath("/history");
  revalidatePath("/financial/invoice-collections");

  return { ok: true as const };
}

export async function resetInvoicePaymentToAutoAllocation(paymentId: string) {
  const user = await requireInvoiceCollectionsWriter();

  await prisma.$transaction(async (tx) => {
    const payment = await tx.invoicePayment.findUniqueOrThrow({
      where: { id: paymentId },
      include: {
        allocations: {
          where: { isManual: true },
          orderBy: [{ yearMonth: "asc" }, { invoiceKey: "asc" }],
        },
      },
    });
    const currency = parseCurrency(payment.currency);
    const customerKey = payment.customerKey;
    const customerName = await resolveCustomerName(customerKey, currency);
    const beforeAllocations = allocationRowsFromDb(
      await tx.invoicePaymentAllocation.findMany({
        where: { paymentId },
        orderBy: [{ yearMonth: "asc" }, { invoiceKey: "asc" }],
      })
    );
    const beforeUnallocated = Number(payment.unallocatedAmount);

    await resetPaymentToAutoAllocation(paymentId, tx, user.id);
    await runAutoAllocation(customerKey, currency, tx);

    const refreshed = await tx.invoicePayment.findUniqueOrThrow({
      where: { id: paymentId },
      include: {
        allocations: {
          orderBy: [{ yearMonth: "asc" }, { invoiceKey: "asc" }],
        },
      },
    });

    await appendInvoicePaymentChangeLogs(tx, {
      actorUserId: user.id,
      logs: [
        {
          paymentId,
          customerKey,
          currency,
          eventType: "reset_to_auto",
          metadata: buildInvoicePaymentAllocationMetadata({
            customerKey,
            customerName,
            currency,
            amount: Number(payment.amount),
            allocationsBefore: beforeAllocations,
            allocationsAfter: allocationRowsFromDb(refreshed.allocations),
            unallocatedBefore: beforeUnallocated,
            unallocatedAfter: Number(refreshed.unallocatedAmount),
          }),
        },
      ],
    });
  });

  revalidatePath("/history");
  revalidatePath("/financial/invoice-collections");

  return { ok: true as const };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/** Test-only helper for permission checks without DB writes. */
export async function assertInvoiceCollectionsWriteAccess() {
  await requireInvoiceCollectionsWriter();
  return { ok: true as const, nonce: randomUUID() };
}
