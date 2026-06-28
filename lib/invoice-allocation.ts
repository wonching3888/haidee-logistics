import type { Prisma } from "@prisma/client";
import { currentCalendarYearMonth } from "@/lib/parse-year-month-params";
import { prisma } from "@/lib/prisma";
import {
  compareReceivableInvoices,
  loadReceivableInvoicesForRange,
  parseReceivableCustomerKey,
  type ReceivableCurrency,
  type ReceivableInvoice,
  type ReceivableInvoiceType,
} from "@/lib/receivable-invoices";

export type InvoiceCollectionStatus = "unpaid" | "partial" | "paid";

export interface AllocationInvoiceInput {
  invoiceType: ReceivableInvoiceType;
  invoiceKey: string;
  yearMonth: string;
  sortDate: string;
  currency: ReceivableCurrency;
  totalAmount: number;
}

export interface AllocationPaymentInput {
  id: string;
  amount: number;
  paymentDate: string;
  createdAt: string;
}

export interface ManualAllocationInput {
  paymentId: string;
  invoiceType: ReceivableInvoiceType;
  invoiceKey: string;
  amount: number;
}

export interface ComputedAllocation {
  paymentId: string;
  invoiceType: ReceivableInvoiceType;
  invoiceKey: string;
  yearMonth: string;
  currency: ReceivableCurrency;
  amount: number;
  isManual: false;
}

export interface AutoAllocationResult {
  allocations: ComputedAllocation[];
  paymentUnallocated: Record<string, number>;
}

export interface ReceivableInvoiceWithCollection extends ReceivableInvoice {
  allocatedAmount: number;
  openAmount: number;
  collectionStatus: InvoiceCollectionStatus;
}

export interface InvoicePaymentAllocationView {
  invoiceType: ReceivableInvoiceType;
  invoiceKey: string;
  invoiceNo: string | null;
  yearMonth: string;
  amount: number;
}

export interface InvoicePaymentView {
  id: string;
  paymentDate: string;
  bankAccount: string;
  amount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  notes: string | null;
  allocations: InvoicePaymentAllocationView[];
}

const LEDGER_INVOICE_START_YEAR = 2020;
const MONEY_EPSILON = 0.001;

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function computeInvoiceCollectionStatus(
  totalAmount: number,
  allocatedAmount: number
): InvoiceCollectionStatus {
  if (allocatedAmount <= MONEY_EPSILON) return "unpaid";
  if (allocatedAmount + MONEY_EPSILON >= totalAmount) return "paid";
  return "partial";
}

function invoiceLedgerKey(invoiceType: string, invoiceKey: string) {
  return `${invoiceType}|${invoiceKey}`;
}

function sortPayments(a: AllocationPaymentInput, b: AllocationPaymentInput) {
  const dateCompare = a.paymentDate.localeCompare(b.paymentDate);
  if (dateCompare !== 0) return dateCompare;
  return a.createdAt.localeCompare(b.createdAt);
}

export function computeAutoFifoAllocations(input: {
  currency: ReceivableCurrency;
  invoices: AllocationInvoiceInput[];
  payments: AllocationPaymentInput[];
  manualAllocations?: ManualAllocationInput[];
}): AutoAllocationResult {
  const manualAllocations = input.manualAllocations ?? [];
  const invoices = [...input.invoices]
    .filter((invoice) => invoice.currency === input.currency)
    .sort((a, b) => {
      const yearMonthCompare = a.yearMonth.localeCompare(b.yearMonth);
      if (yearMonthCompare !== 0) return yearMonthCompare;
      const sortDateCompare = a.sortDate.localeCompare(b.sortDate);
      if (sortDateCompare !== 0) return sortDateCompare;
      return a.invoiceKey.localeCompare(b.invoiceKey);
    });

  const manualByInvoice = new Map<string, number>();
  const manualByPayment = new Map<string, number>();

  for (const row of manualAllocations) {
    const key = invoiceLedgerKey(row.invoiceType, row.invoiceKey);
    manualByInvoice.set(key, roundMoney((manualByInvoice.get(key) ?? 0) + row.amount));
    manualByPayment.set(
      row.paymentId,
      roundMoney((manualByPayment.get(row.paymentId) ?? 0) + row.amount)
    );
  }

  const openByInvoice = new Map<string, number>();
  const yearMonthByInvoice = new Map<string, string>();

  for (const invoice of invoices) {
    const key = invoiceLedgerKey(invoice.invoiceType, invoice.invoiceKey);
    const manualAllocated = manualByInvoice.get(key) ?? 0;
    openByInvoice.set(
      key,
      roundMoney(Math.max(0, invoice.totalAmount - manualAllocated))
    );
    yearMonthByInvoice.set(key, invoice.yearMonth);
  }

  const payments = [...input.payments].sort(sortPayments);
  const allocations: ComputedAllocation[] = [];
  const paymentUnallocated: Record<string, number> = {};

  for (const payment of payments) {
    let pool = roundMoney(
      Math.max(0, payment.amount - (manualByPayment.get(payment.id) ?? 0))
    );

    for (const invoice of invoices) {
      if (pool <= MONEY_EPSILON) break;

      const key = invoiceLedgerKey(invoice.invoiceType, invoice.invoiceKey);
      const open = openByInvoice.get(key) ?? 0;
      if (open <= MONEY_EPSILON) continue;

      const alloc = roundMoney(Math.min(pool, open));
      if (alloc <= MONEY_EPSILON) continue;

      allocations.push({
        paymentId: payment.id,
        invoiceType: invoice.invoiceType,
        invoiceKey: invoice.invoiceKey,
        yearMonth: yearMonthByInvoice.get(key) ?? invoice.yearMonth,
        currency: input.currency,
        amount: alloc,
        isManual: false,
      });

      openByInvoice.set(key, roundMoney(open - alloc));
      pool = roundMoney(pool - alloc);
    }

    paymentUnallocated[payment.id] = pool;
  }

  return { allocations, paymentUnallocated };
}

export async function loadReceivableInvoicesForCustomerLedger(
  customerKey: string,
  currency: ReceivableCurrency
): Promise<ReceivableInvoice[]> {
  parseReceivableCustomerKey(customerKey);
  const now = currentCalendarYearMonth();
  const invoices = await loadReceivableInvoicesForRange({
    fromYear: LEDGER_INVOICE_START_YEAR,
    fromMonth: 1,
    toYear: now.year,
    toMonth: now.month,
  });

  return invoices
    .filter(
      (invoice) =>
        invoice.customerKey === customerKey && invoice.currency === currency
    )
    .sort(compareReceivableInvoices);
}

function toAllocationInvoiceInput(
  invoice: ReceivableInvoice
): AllocationInvoiceInput {
  return {
    invoiceType: invoice.invoiceType,
    invoiceKey: invoice.invoiceKey,
    yearMonth: invoice.yearMonth,
    sortDate: invoice.sortDate,
    currency: invoice.currency,
    totalAmount: invoice.totalAmount,
  };
}

export type InvoiceAllocationTransaction = Prisma.TransactionClient;

export async function runAutoAllocation(
  customerKey: string,
  currency: ReceivableCurrency,
  tx: InvoiceAllocationTransaction
): Promise<AutoAllocationResult> {
  parseReceivableCustomerKey(customerKey);

  const [invoices, payments, manualAllocations] = await Promise.all([
    loadReceivableInvoicesForCustomerLedger(customerKey, currency),
    tx.invoicePayment.findMany({
      where: { customerKey, currency },
      orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
    }),
    tx.invoicePaymentAllocation.findMany({
      where: {
        isManual: true,
        payment: { customerKey, currency },
      },
    }),
  ]);

  const result = computeAutoFifoAllocations({
    currency,
    invoices: invoices.map(toAllocationInvoiceInput),
    payments: payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      paymentDate: payment.paymentDate.toISOString().slice(0, 10),
      createdAt: payment.createdAt.toISOString(),
    })),
    manualAllocations: manualAllocations.map((row) => ({
      paymentId: row.paymentId,
      invoiceType: row.invoiceType as ReceivableInvoiceType,
      invoiceKey: row.invoiceKey,
      amount: Number(row.amount),
    })),
  });

  await tx.invoicePaymentAllocation.deleteMany({
    where: {
      isManual: false,
      payment: { customerKey, currency },
    },
  });

  if (result.allocations.length > 0) {
    await tx.invoicePaymentAllocation.createMany({
      data: result.allocations.map((row) => ({
        paymentId: row.paymentId,
        invoiceType: row.invoiceType,
        invoiceKey: row.invoiceKey,
        yearMonth: row.yearMonth,
        currency: row.currency,
        amount: row.amount,
        isManual: false,
      })),
    });
  }

  for (const payment of payments) {
    await tx.invoicePayment.update({
      where: { id: payment.id },
      data: {
        unallocatedAmount: result.paymentUnallocated[payment.id] ?? 0,
      },
    });
  }

  return result;
}

export async function loadInvoicePaymentsForLedger(
  customerKey: string,
  currency: ReceivableCurrency,
  invoicesInScope: ReceivableInvoice[]
): Promise<InvoicePaymentView[]> {
  const invoiceNoByKey = new Map(
    invoicesInScope.map((invoice) => [
      invoiceLedgerKey(invoice.invoiceType, invoice.invoiceKey),
      invoice.invoiceNo,
    ])
  );

  const rows = await prisma.invoicePayment.findMany({
    where: { customerKey, currency },
    orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
    include: {
      allocations: {
        orderBy: [{ yearMonth: "asc" }, { invoiceKey: "asc" }],
      },
    },
  });

  return rows.map((payment) => ({
    id: payment.id,
    paymentDate: payment.paymentDate.toISOString().slice(0, 10),
    bankAccount: payment.bankAccount,
    amount: roundMoney(Number(payment.amount)),
    allocatedAmount: roundMoney(
      Number(payment.amount) - Number(payment.unallocatedAmount)
    ),
    unallocatedAmount: roundMoney(Number(payment.unallocatedAmount)),
    notes: payment.notes,
    allocations: payment.allocations.map((row) => ({
      invoiceType: row.invoiceType as ReceivableInvoiceType,
      invoiceKey: row.invoiceKey,
      invoiceNo:
        invoiceNoByKey.get(
          invoiceLedgerKey(row.invoiceType, row.invoiceKey)
        ) ?? null,
      yearMonth: row.yearMonth,
      amount: roundMoney(Number(row.amount)),
    })),
  }));
}

export async function loadAllocatedAmountsForInvoices(
  invoices: ReceivableInvoice[]
): Promise<Map<string, number>> {
  if (invoices.length === 0) return new Map();

  const keys = invoices.map((invoice) => ({
    invoiceType: invoice.invoiceType,
    invoiceKey: invoice.invoiceKey,
  }));

  const rows = await prisma.invoicePaymentAllocation.groupBy({
    by: ["invoiceType", "invoiceKey"],
    where: {
      OR: keys,
    },
    _sum: { amount: true },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(
      invoiceLedgerKey(row.invoiceType, row.invoiceKey),
      roundMoney(Number(row._sum.amount ?? 0))
    );
  }
  return map;
}

export function enrichInvoicesWithCollection(
  invoices: ReceivableInvoice[],
  allocatedByInvoice: Map<string, number>
): ReceivableInvoiceWithCollection[] {
  return invoices.map((invoice) => {
    const allocatedAmount =
      allocatedByInvoice.get(
        invoiceLedgerKey(invoice.invoiceType, invoice.invoiceKey)
      ) ?? 0;
    const openAmount = roundMoney(
      Math.max(0, invoice.totalAmount - allocatedAmount)
    );
    return {
      ...invoice,
      allocatedAmount,
      openAmount,
      collectionStatus: computeInvoiceCollectionStatus(
        invoice.totalAmount,
        allocatedAmount
      ),
    };
  });
}

export async function previewAutoAllocationForNewPayment(input: {
  customerKey: string;
  currency: ReceivableCurrency;
  newPayment: {
    id: string;
    amount: number;
    paymentDate: string;
    createdAt: string;
  };
}): Promise<AutoAllocationResult> {
  const [invoices, existingPayments, manualAllocations] = await Promise.all([
    loadReceivableInvoicesForCustomerLedger(
      input.customerKey,
      input.currency
    ),
    prisma.invoicePayment.findMany({
      where: {
        customerKey: input.customerKey,
        currency: input.currency,
      },
      orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.invoicePaymentAllocation.findMany({
      where: {
        isManual: true,
        payment: {
          customerKey: input.customerKey,
          currency: input.currency,
        },
      },
    }),
  ]);

  const payments = [
    ...existingPayments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      paymentDate: payment.paymentDate.toISOString().slice(0, 10),
      createdAt: payment.createdAt.toISOString(),
    })),
    input.newPayment,
  ].sort(sortPayments);

  return computeAutoFifoAllocations({
    currency: input.currency,
    invoices: invoices.map(toAllocationInvoiceInput),
    payments,
    manualAllocations: manualAllocations.map((row) => ({
      paymentId: row.paymentId,
      invoiceType: row.invoiceType as ReceivableInvoiceType,
      invoiceKey: row.invoiceKey,
      amount: Number(row.amount),
    })),
  });
}

export function formatAllocationPreviewRows(
  result: AutoAllocationResult,
  invoices: ReceivableInvoice[],
  paymentId: string
) {
  const invoiceByKey = new Map(
    invoices.map((invoice) => [
      invoiceLedgerKey(invoice.invoiceType, invoice.invoiceKey),
      invoice,
    ])
  );

  return result.allocations
    .filter((row) => row.paymentId === paymentId)
    .map((row) => {
      const invoice = invoiceByKey.get(
        invoiceLedgerKey(row.invoiceType, row.invoiceKey)
      );
      return {
        invoiceType: row.invoiceType,
        invoiceKey: row.invoiceKey,
        invoiceNo: invoice?.invoiceNo ?? null,
        yearMonth: row.yearMonth,
        amount: row.amount,
      };
    });
}
