import type { Prisma } from "@prisma/client";
import type { InvoiceBankAccount } from "@/lib/constants/invoice-bank-accounts";
import type { ReceivableCurrency } from "@/lib/receivable-invoices";

export type InvoicePaymentAuditEventType =
  | "create"
  | "update"
  | "delete"
  | "manual_override"
  | "reset_to_auto";

export const INVOICE_PAYMENT_AUDITED_FIELDS = [
  "amount",
  "paymentDate",
  "bankAccount",
  "notes",
  "customerKey",
  "currency",
] as const;

export type InvoicePaymentAuditedField =
  (typeof INVOICE_PAYMENT_AUDITED_FIELDS)[number];

export const INVOICE_PAYMENT_FIELD_LABELS: Record<
  InvoicePaymentAuditedField,
  string
> = {
  amount: "金额 Amount",
  paymentDate: "付款日期 Payment date",
  bankAccount: "来款户口 Bank account",
  notes: "备注 Notes",
  customerKey: "客户 Customer",
  currency: "币种 Currency",
};

export const INVOICE_PAYMENT_EVENT_LABELS: Record<
  InvoicePaymentAuditEventType,
  string
> = {
  create: "录款",
  update: "改款",
  delete: "删款",
  manual_override: "手动冲账",
  reset_to_auto: "恢复自动冲账",
};

export interface InvoicePaymentAllocationSummary {
  invoiceType: string;
  invoiceKey: string;
  yearMonth: string;
  amount: number;
  isManual?: boolean;
}

export interface InvoicePaymentFieldChange {
  field: InvoicePaymentAuditedField;
  fromValue: string | null;
  toValue: string | null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function decimalToAuditString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const num = (value as { toNumber(): number }).toNumber();
    if (!Number.isFinite(num)) return null;
    return roundMoney(num).toFixed(2);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return roundMoney(value).toFixed(2);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return roundMoney(parsed).toFixed(2);
  }
  return String(value);
}

function notesToAuditString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

export function dateToAuditString(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  return text === "" ? null : text.slice(0, 10);
}

function moneyToAuditNumber(value: unknown): number {
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return roundMoney((value as { toNumber(): number }).toNumber());
  }
  return roundMoney(Number(value));
}

export function summarizeAllocations(
  rows: InvoicePaymentAllocationSummary[]
): string {
  if (rows.length === 0) return "—";
  return rows
    .map((row) => {
      const manual = row.isManual ? " [手动]" : "";
      return `${row.yearMonth} ${row.invoiceType}|${row.invoiceKey}: ${roundMoney(row.amount).toFixed(2)}${manual}`;
    })
    .join("; ");
}

export function allocationRowsFromDb(
  rows: Array<{
    invoiceType: string;
    invoiceKey: string;
    yearMonth: string;
    amount: unknown;
    isManual?: boolean;
  }>
): InvoicePaymentAllocationSummary[] {
  return rows.map((row) => ({
    invoiceType: row.invoiceType,
    invoiceKey: row.invoiceKey,
    yearMonth: row.yearMonth,
    amount: roundMoney(Number(row.amount)),
    isManual: row.isManual,
  }));
}

export function diffInvoicePaymentFieldChanges(
  existing: {
    amount: unknown;
    paymentDate: unknown;
    bankAccount: string;
    notes: string | null;
    customerKey: string;
    currency: string;
  },
  input: {
    amount: number;
    paymentDate: Date;
    bankAccount: string;
    notes: string | null;
    customerKey: string;
    currency: string;
  }
): InvoicePaymentFieldChange[] {
  const pairs: Array<
    [InvoicePaymentAuditedField, string | null, string | null]
  > = [
    [
      "amount",
      decimalToAuditString(existing.amount),
      decimalToAuditString(input.amount),
    ],
    [
      "paymentDate",
      dateToAuditString(existing.paymentDate),
      dateToAuditString(input.paymentDate),
    ],
    [
      "bankAccount",
      existing.bankAccount,
      input.bankAccount,
    ],
    [
      "notes",
      notesToAuditString(existing.notes),
      notesToAuditString(input.notes),
    ],
    [
      "customerKey",
      existing.customerKey,
      input.customerKey,
    ],
    [
      "currency",
      existing.currency,
      input.currency,
    ],
  ];

  const changes: InvoicePaymentFieldChange[] = [];
  for (const [field, fromValue, toValue] of pairs) {
    if (fromValue === toValue) continue;
    changes.push({ field, fromValue, toValue });
  }
  return changes;
}

export interface InvoicePaymentChangeLogInput {
  paymentId?: string | null;
  customerKey?: string | null;
  currency?: ReceivableCurrency | string | null;
  eventType: InvoicePaymentAuditEventType;
  field?: string | null;
  fromValue?: string | null;
  toValue?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

export async function appendInvoicePaymentChangeLogs(
  tx: Prisma.TransactionClient,
  input: {
    actorUserId: string;
    logs: InvoicePaymentChangeLogInput[];
  }
) {
  if (input.logs.length === 0) return;

  await tx.invoicePaymentChangeLog.createMany({
    data: input.logs.map((log) => ({
      paymentId: log.paymentId ?? null,
      customerKey: log.customerKey ?? null,
      currency: log.currency ?? null,
      eventType: log.eventType,
      field: log.field ?? null,
      fromValue: log.fromValue ?? null,
      toValue: log.toValue ?? null,
      metadata: log.metadata ?? undefined,
      changedBy: input.actorUserId,
    })),
  });
}

export function invoicePaymentAuditFieldLabel(field: string) {
  return (
    INVOICE_PAYMENT_FIELD_LABELS[field as InvoicePaymentAuditedField] ?? field
  );
}

export function invoicePaymentAuditEventLabel(
  eventType: InvoicePaymentAuditEventType | string
) {
  return (
    INVOICE_PAYMENT_EVENT_LABELS[eventType as InvoicePaymentAuditEventType] ??
    eventType
  );
}

export function buildInvoicePaymentCreateMetadata(input: {
  customerKey: string;
  customerKind: string;
  customerName?: string | null;
  currency: ReceivableCurrency;
  amount: number;
  paymentDate: string;
  bankAccount: InvoiceBankAccount | string;
  notes?: string | null;
  allocationsAfter: InvoicePaymentAllocationSummary[];
  unallocatedAfter: number;
}): Prisma.InputJsonValue {
  return {
    customerKey: input.customerKey,
    customerKind: input.customerKind,
    customerName: input.customerName ?? null,
    currency: input.currency,
    amount: roundMoney(input.amount),
    paymentDate: input.paymentDate,
    bankAccount: input.bankAccount,
    notes: input.notes ?? null,
    allocationsAfter: input.allocationsAfter,
    allocationsAfterSummary: summarizeAllocations(input.allocationsAfter),
    unallocatedAfter: roundMoney(input.unallocatedAfter),
  } as unknown as Prisma.InputJsonValue;
}

export function buildInvoicePaymentDeleteMetadata(input: {
  customerKey: string;
  customerKind: string;
  customerName?: string | null;
  currency: ReceivableCurrency;
  amount: unknown;
  paymentDate: unknown;
  bankAccount: string;
  notes?: unknown;
  allocationsBefore: InvoicePaymentAllocationSummary[];
  unallocatedBefore: unknown;
}): Prisma.InputJsonValue {
  const paymentDate = dateToAuditString(input.paymentDate);
  if (!paymentDate) {
    throw new Error("删款留痕缺少付款日期 Missing payment date for delete audit");
  }

  return {
    customerKey: input.customerKey,
    customerKind: input.customerKind,
    customerName: input.customerName ?? null,
    currency: input.currency,
    amount: moneyToAuditNumber(input.amount),
    paymentDate,
    bankAccount: input.bankAccount,
    notes: notesToAuditString(input.notes),
    allocationsBefore: input.allocationsBefore.map((row) => ({
      invoiceType: row.invoiceType,
      invoiceKey: row.invoiceKey,
      yearMonth: row.yearMonth,
      amount: roundMoney(row.amount),
      ...(row.isManual ? { isManual: true } : {}),
    })),
    allocationsBeforeSummary: summarizeAllocations(input.allocationsBefore),
    unallocatedBefore: moneyToAuditNumber(input.unallocatedBefore),
  } as unknown as Prisma.InputJsonValue;
}

export function buildInvoicePaymentAllocationMetadata(input: {
  customerKey: string;
  customerName?: string | null;
  currency: ReceivableCurrency;
  amount: number;
  allocationsBefore: InvoicePaymentAllocationSummary[];
  allocationsAfter: InvoicePaymentAllocationSummary[];
  unallocatedBefore?: number;
  unallocatedAfter?: number;
}): Prisma.InputJsonValue {
  return {
    customerKey: input.customerKey,
    customerName: input.customerName ?? null,
    currency: input.currency,
    amount: roundMoney(input.amount),
    allocationsBefore: input.allocationsBefore,
    allocationsBeforeSummary: summarizeAllocations(input.allocationsBefore),
    allocationsAfter: input.allocationsAfter,
    allocationsAfterSummary: summarizeAllocations(input.allocationsAfter),
    unallocatedBefore:
      input.unallocatedBefore != null
        ? roundMoney(input.unallocatedBefore)
        : undefined,
    unallocatedAfter:
      input.unallocatedAfter != null
        ? roundMoney(input.unallocatedAfter)
        : undefined,
  } as unknown as Prisma.InputJsonValue;
}

export function invoiceCollectionsDeepLink(input: {
  customerKey: string;
  currency: string;
}) {
  const params = new URLSearchParams();
  params.set("customerKey", input.customerKey);
  params.set("currency", input.currency);
  params.set("q", "1");
  return `/financial/invoice-collections?${params.toString()}`;
}
