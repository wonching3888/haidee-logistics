"use server";

import { getCurrentUser } from "@/lib/auth";
import {
  canViewInvoiceCollections,
  canWriteInvoiceCollections,
} from "@/lib/auth-roles";
import {
  enrichInvoicesWithCollection,
  loadAllocatedAmountsForInvoices,
  loadInvoicePaymentsForLedger,
} from "@/lib/invoice-allocation";
import type { UserRole } from "@/types";
import {
  filterReceivableInvoicesForLedger,
  groupReceivableCustomerLedgers,
  loadReceivableInvoicesForRange,
  summarizeReceivableOverview,
  type ReceivableCurrency,
} from "@/lib/receivable-invoices";

async function requireInvoiceCollectionsViewer() {
  const user = await getCurrentUser();
  if (!user || !canViewInvoiceCollections(user.role as UserRole)) {
    throw new Error("无权限查看 Invoice 收账 Unauthorized");
  }
  return user;
}

function parseYearMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("无效年份 Invalid year");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("无效月份 Invalid month");
  }
}

function parseCurrency(value: string | null | undefined): ReceivableCurrency | null {
  if (!value) return null;
  if (value === "THB" || value === "MYR") return value;
  throw new Error("无效币种 Invalid currency");
}

export async function getInvoiceCollectionsPageData(input: {
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  customerKey?: string | null;
  currency?: string | null;
}) {
  const user = await requireInvoiceCollectionsViewer();
  parseYearMonth(input.fromYear, input.fromMonth);
  parseYearMonth(input.toYear, input.toMonth);

  const fromKey = input.fromYear * 100 + input.fromMonth;
  const toKey = input.toYear * 100 + input.toMonth;
  if (fromKey > toKey) {
    throw new Error("起始月份不能晚于结束月份 Invalid date range");
  }

  const currency = parseCurrency(input.currency);
  const customerKey = input.customerKey?.trim() || null;

  if ((customerKey && !currency) || (!customerKey && currency)) {
    throw new Error("客户与币种须同时提供 Customer and currency are required together");
  }

  const invoices = await loadReceivableInvoicesForRange({
    fromYear: input.fromYear,
    fromMonth: input.fromMonth,
    toYear: input.toYear,
    toMonth: input.toMonth,
  });

  const ledgers = groupReceivableCustomerLedgers(invoices);
  const overview = summarizeReceivableOverview(invoices);

  let detail: {
    customerKey: string;
    currency: ReceivableCurrency;
    invoices: ReturnType<typeof enrichInvoicesWithCollection>;
    payments: Awaited<ReturnType<typeof loadInvoicePaymentsForLedger>>;
    totalReceivable: number;
    totalOpen: number;
  } | null = null;

  if (customerKey && currency) {
    const detailInvoices = filterReceivableInvoicesForLedger(
      invoices,
      customerKey,
      currency
    );
    const allocatedByInvoice = await loadAllocatedAmountsForInvoices(
      detailInvoices
    );
    const enrichedInvoices = enrichInvoicesWithCollection(
      detailInvoices,
      allocatedByInvoice
    );
    const payments = await loadInvoicePaymentsForLedger(
      customerKey,
      currency,
      detailInvoices
    );

    detail = {
      customerKey,
      currency,
      invoices: enrichedInvoices,
      payments,
      totalReceivable:
        Math.round(
          detailInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0) *
            100
        ) / 100,
      totalOpen:
        Math.round(
          enrichedInvoices.reduce((sum, invoice) => sum + invoice.openAmount, 0) *
            100
        ) / 100,
    };
  }

  return {
    fromYear: input.fromYear,
    fromMonth: input.fromMonth,
    toYear: input.toYear,
    toMonth: input.toMonth,
    ledgers,
    overview,
    invoiceCount: invoices.length,
    detail,
    canWritePayments: canWriteInvoiceCollections(user.role as UserRole),
  };
}

export type InvoiceCollectionsPageData = Awaited<
  ReturnType<typeof getInvoiceCollectionsPageData>
>;

export type InvoiceCollectionsDetailInvoice =
  NonNullable<InvoiceCollectionsPageData["detail"]>["invoices"][number];

export type InvoiceCollectionsDetailPayment =
  NonNullable<InvoiceCollectionsPageData["detail"]>["payments"][number];
