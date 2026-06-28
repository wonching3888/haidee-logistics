import type { Prisma } from "@prisma/client";
import { currentCalendarYearMonth } from "@/lib/parse-year-month-params";
import { prisma } from "@/lib/prisma";
import {
  compareReceivableInvoices,
  loadReceivableInvoicesForRange,
  parseReceivableCustomerKey,
  type ReceivableCurrency,
  type ReceivableCustomerLedger,
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
  isOverAllocated: boolean;
}

export interface ManualAllocationRowInput {
  invoiceType: ReceivableInvoiceType;
  invoiceKey: string;
  amount: number;
}

export interface ManualAllocationOverInvoiceWarning {
  invoiceType: ReceivableInvoiceType;
  invoiceKey: string;
  invoiceNo: string | null;
  yearMonth: string;
  totalAmount: number;
  otherAllocated: number;
  manualAmount: number;
  projectedAllocated: number;
}

export interface ReceivableCustomerLedgerWithCollection
  extends ReceivableCustomerLedger {
  totalAllocated: number;
  totalOpen: number;
  collectionStatus: InvoiceCollectionStatus;
  prepaymentAmount: number;
  hasPrepayment: boolean;
}

export interface InvoicePaymentAllocationView {
  invoiceType: ReceivableInvoiceType;
  invoiceKey: string;
  invoiceNo: string | null;
  yearMonth: string;
  amount: number;
  isManual: boolean;
}

export interface InvoicePaymentView {
  id: string;
  paymentDate: string;
  bankAccount: string;
  amount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  notes: string | null;
  allocationStrategy: "auto" | "manual";
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

export function isInvoiceOverAllocated(
  totalAmount: number,
  allocatedAmount: number
): boolean {
  return allocatedAmount > totalAmount + MONEY_EPSILON;
}

function invoiceLedgerKey(invoiceType: string, invoiceKey: string) {
  return `${invoiceType}|${invoiceKey}`;
}

export function ledgerCollectionKey(
  customerKey: string,
  currency: ReceivableCurrency
) {
  return `${customerKey}|${currency}`;
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

export async function rerunAutoAllocationForLedgers(
  ledgers: Array<{ customerKey: string; currency: ReceivableCurrency }>,
  tx: InvoiceAllocationTransaction
) {
  const seen = new Set<string>();
  for (const ledger of ledgers) {
    const key = ledgerCollectionKey(ledger.customerKey, ledger.currency);
    if (seen.has(key)) continue;
    seen.add(key);
    await runAutoAllocation(ledger.customerKey, ledger.currency, tx);
  }
}

export function validateManualAllocationRows(input: {
  paymentAmount: number;
  currency: ReceivableCurrency;
  customerKey: string;
  allocations: ManualAllocationRowInput[];
  invoices: ReceivableInvoice[];
  allocatedByInvoiceExcludingPayment: Map<string, number>;
  confirmOverAllocation?: boolean;
}): ManualAllocationOverInvoiceWarning[] {
  if (input.allocations.length === 0) {
    throw new Error("请至少指定一笔冲账 Please specify at least one allocation");
  }

  const invoiceByKey = new Map(
    input.invoices.map((invoice) => [
      invoiceLedgerKey(invoice.invoiceType, invoice.invoiceKey),
      invoice,
    ])
  );

  let manualSum = 0;
  const manualByInvoice = new Map<string, number>();

  for (const row of input.allocations) {
    const amount = roundMoney(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("冲账金额须大于 0 Allocation amount must be greater than zero");
    }

    const invoice = invoiceByKey.get(
      invoiceLedgerKey(row.invoiceType, row.invoiceKey)
    );
    if (!invoice) {
      throw new Error("无效 Invoice Invalid invoice");
    }
    if (
      invoice.customerKey !== input.customerKey ||
      invoice.currency !== input.currency
    ) {
      throw new Error("Invoice 须属于当前客户账本 Invoice must belong to current ledger");
    }

    manualSum = roundMoney(manualSum + amount);
    const key = invoiceLedgerKey(row.invoiceType, row.invoiceKey);
    manualByInvoice.set(key, roundMoney((manualByInvoice.get(key) ?? 0) + amount));
  }

  if (manualSum > input.paymentAmount + MONEY_EPSILON) {
    throw new Error(
      "手动冲账合计不能超过来款金额 Manual allocations cannot exceed payment amount"
    );
  }

  const overWarnings: ManualAllocationOverInvoiceWarning[] = [];
  for (const [key, manualAmount] of Array.from(manualByInvoice.entries())) {
    const invoice = invoiceByKey.get(key);
    if (!invoice) continue;
    const otherAllocated = roundMoney(
      input.allocatedByInvoiceExcludingPayment.get(key) ?? 0
    );
    const projectedAllocated = roundMoney(otherAllocated + manualAmount);
    if (isInvoiceOverAllocated(invoice.totalAmount, projectedAllocated)) {
      overWarnings.push({
        invoiceType: invoice.invoiceType,
        invoiceKey: invoice.invoiceKey,
        invoiceNo: invoice.invoiceNo,
        yearMonth: invoice.yearMonth,
        totalAmount: invoice.totalAmount,
        otherAllocated,
        manualAmount,
        projectedAllocated,
      });
    }
  }

  if (overWarnings.length > 0 && !input.confirmOverAllocation) {
    throw new Error(
      "部分 Invoice 冲账将超过总额,请确认后提交 Some invoices would be over-allocated; confirm to proceed"
    );
  }

  return overWarnings;
}

export async function applyManualAllocationsForPayment(
  paymentId: string,
  allocations: ManualAllocationRowInput[],
  invoices: ReceivableInvoice[],
  tx: InvoiceAllocationTransaction,
  updatedBy: string
) {
  const invoiceByKey = new Map(
    invoices.map((invoice) => [
      invoiceLedgerKey(invoice.invoiceType, invoice.invoiceKey),
      invoice,
    ])
  );

  await tx.invoicePaymentAllocation.deleteMany({
    where: { paymentId },
  });

  if (allocations.length > 0) {
    await tx.invoicePaymentAllocation.createMany({
      data: allocations.map((row) => {
        const invoice = invoiceByKey.get(
          invoiceLedgerKey(row.invoiceType, row.invoiceKey)
        );
        if (!invoice) {
          throw new Error("无效 Invoice Invalid invoice");
        }
        return {
          paymentId,
          invoiceType: row.invoiceType,
          invoiceKey: row.invoiceKey,
          yearMonth: invoice.yearMonth,
          currency: invoice.currency,
          amount: roundMoney(row.amount),
          isManual: true,
        };
      }),
    });
  }

  await tx.invoicePayment.update({
    where: { id: paymentId },
    data: {
      allocationStrategy: "manual",
      updatedBy,
    },
  });
}

export async function resetPaymentToAutoAllocation(
  paymentId: string,
  tx: InvoiceAllocationTransaction,
  updatedBy: string
) {
  await tx.invoicePaymentAllocation.deleteMany({
    where: { paymentId, isManual: true },
  });

  await tx.invoicePayment.update({
    where: { id: paymentId },
    data: {
      allocationStrategy: "auto",
      updatedBy,
    },
  });
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
    allocationStrategy:
      payment.allocationStrategy === "manual" ? "manual" : "auto",
    allocations: payment.allocations.map((row) => ({
      invoiceType: row.invoiceType as ReceivableInvoiceType,
      invoiceKey: row.invoiceKey,
      invoiceNo:
        invoiceNoByKey.get(
          invoiceLedgerKey(row.invoiceType, row.invoiceKey)
        ) ?? null,
      yearMonth: row.yearMonth,
      amount: roundMoney(Number(row.amount)),
      isManual: row.isManual,
    })),
  }));
}

export async function loadAllocatedAmountsForInvoices(
  invoices: ReceivableInvoice[],
  options?: { excludePaymentId?: string }
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
      ...(options?.excludePaymentId
        ? { paymentId: { not: options.excludePaymentId } }
        : {}),
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

export async function loadUnallocatedAmountsByLedger(
  ledgers: Array<{ customerKey: string; currency: ReceivableCurrency }>
): Promise<Map<string, number>> {
  if (ledgers.length === 0) return new Map();

  const rows = await prisma.invoicePayment.groupBy({
    by: ["customerKey", "currency"],
    where: {
      OR: ledgers.map((ledger) => ({
        customerKey: ledger.customerKey,
        currency: ledger.currency,
      })),
    },
    _sum: { unallocatedAmount: true },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    const amount = roundMoney(Number(row._sum.unallocatedAmount ?? 0));
    if (amount <= MONEY_EPSILON) continue;
    map.set(
      ledgerCollectionKey(
        row.customerKey,
        row.currency as ReceivableCurrency
      ),
      amount
    );
  }
  return map;
}

export function enrichCustomerLedgersWithCollection(
  ledgers: ReceivableCustomerLedger[],
  invoices: ReceivableInvoice[],
  allocatedByInvoice: Map<string, number>,
  unallocatedByLedger: Map<string, number>
): ReceivableCustomerLedgerWithCollection[] {
  const invoicesByLedger = new Map<string, ReceivableInvoice[]>();
  for (const invoice of invoices) {
    const key = ledgerCollectionKey(invoice.customerKey, invoice.currency);
    const bucket = invoicesByLedger.get(key);
    if (bucket) {
      bucket.push(invoice);
    } else {
      invoicesByLedger.set(key, [invoice]);
    }
  }

  return ledgers.map((ledger) => {
    const key = ledgerCollectionKey(ledger.customerKey, ledger.currency);
    const ledgerInvoices = invoicesByLedger.get(key) ?? [];

    let totalAllocated = 0;
    for (const invoice of ledgerInvoices) {
      totalAllocated +=
        allocatedByInvoice.get(
          invoiceLedgerKey(invoice.invoiceType, invoice.invoiceKey)
        ) ?? 0;
    }
    totalAllocated = roundMoney(totalAllocated);
    const totalOpen = roundMoney(
      Math.max(0, ledger.totalReceivable - totalAllocated)
    );
    const prepaymentAmount = roundMoney(unallocatedByLedger.get(key) ?? 0);

    return {
      ...ledger,
      totalAllocated,
      totalOpen,
      collectionStatus: computeInvoiceCollectionStatus(
        ledger.totalReceivable,
        totalAllocated
      ),
      prepaymentAmount,
      hasPrepayment: prepaymentAmount > MONEY_EPSILON,
    };
  });
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
    const overAllocated = isInvoiceOverAllocated(
      invoice.totalAmount,
      allocatedAmount
    );
    const openAmount = roundMoney(invoice.totalAmount - allocatedAmount);
    return {
      ...invoice,
      allocatedAmount,
      openAmount,
      isOverAllocated: overAllocated,
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
