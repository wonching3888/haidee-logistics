"use server";

import { getCurrentUser } from "@/lib/auth";
import { canViewInvoiceCollections } from "@/lib/auth-roles";
import { formatArListingGeneratedAt } from "@/lib/ar-invoice-listing-print";
import { formatInvoicePeriodLabel } from "@/lib/constants/monthly-invoice";
import {
  loadReceivableInvoicesForCustomerLedger,
  loadInvoicePaymentsForLedger,
  loadAllocatedAmountsForInvoices,
  enrichInvoicesWithCollection,
} from "@/lib/invoice-allocation";
import {
  buildDebtorStatement,
  buildDebtorStatementAging,
  type DebtorStatement,
  type DebtorStatementAgingBucket,
} from "@/lib/invoice-collections-statement";
import {
  formatReceivableInvoiceTypeLabel,
  type ReceivableCurrency,
  type ReceivableIssuerKey,
} from "@/lib/receivable-invoices";
import type { UserRole } from "@/types";

async function requireInvoiceCollectionsViewer() {
  const user = await getCurrentUser();
  if (!user || !canViewInvoiceCollections(user.role as UserRole)) {
    throw new Error("无权限查看 Unauthorized");
  }
  return user;
}

function assertReceivableCurrency(value: string): ReceivableCurrency {
  if (value === "THB" || value === "MYR") return value;
  throw new Error(`无效币种 Invalid currency: ${value}`);
}

function monthRangeToDates(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number
) {
  const from = `${fromYear}-${String(fromMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(toYear, toMonth, 0)).getUTCDate();
  const to = `${toYear}-${String(toMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function buildPeriodLabel(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number
) {
  if (fromYear === toYear && fromMonth === toMonth) {
    return formatInvoicePeriodLabel(fromYear, fromMonth);
  }
  return `${formatInvoicePeriodLabel(fromYear, fromMonth)} – ${formatInvoicePeriodLabel(toYear, toMonth)}`;
}

export interface DebtorStatementPrintData {
  customerKey: string;
  customerName: string;
  customerCode: string | null;
  currency: ReceivableCurrency;
  issuerKey: ReceivableIssuerKey;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  periodLabel: string;
  asOfDate: string;
  generatedAtLabel: string;
  userIdLabel: string;
  statement: DebtorStatement;
  aging: {
    buckets: DebtorStatementAgingBucket[];
    total: number;
  };
}

export async function getDebtorStatementPrintData(input: {
  customerKey: string;
  currency: string;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
}): Promise<DebtorStatementPrintData> {
  const user = await requireInvoiceCollectionsViewer();
  const currency = assertReceivableCurrency(input.currency);
  const customerKey = input.customerKey.trim();
  if (!customerKey) {
    throw new Error("缺少客户 Missing customerKey");
  }

  const allInvoices = await loadReceivableInvoicesForCustomerLedger(
    customerKey,
    currency
  );
  if (allInvoices.length === 0) {
    throw new Error("找不到该客户的发票记录 No invoices found for this customer");
  }

  // 第0步诊断确认：目前每个 customerKey+currency 历史上只有单一 issuer，
  // 才能这样简单取第一条；若以后出现混合客户，这里要改成分账逻辑。
  const issuerKey: ReceivableIssuerKey = allInvoices[0]!.issuerKey;

  const payments = await loadInvoicePaymentsForLedger(
    customerKey,
    currency,
    allInvoices
  );
  const allocatedByInvoice = await loadAllocatedAmountsForInvoices(allInvoices);
  const enrichedInvoices = enrichInvoicesWithCollection(
    allInvoices,
    allocatedByInvoice
  );

  const range = monthRangeToDates(
    input.fromYear,
    input.fromMonth,
    input.toYear,
    input.toMonth
  );
  const invoiceLabels = new Map(
    enrichedInvoices.map((inv) => [
      `${inv.invoiceType}|${inv.invoiceKey}`,
      `${formatReceivableInvoiceTypeLabel(inv.invoiceType)} ${inv.yearMonth}`,
    ])
  );

  const statement = buildDebtorStatement({
    invoices: enrichedInvoices,
    payments,
    invoiceLabels,
    range,
  });
  const asOfDate = new Date().toISOString().slice(0, 10);
  const aging = buildDebtorStatementAging({
    invoices: enrichedInvoices,
    asOfDate,
  });

  return {
    customerKey,
    customerName: enrichedInvoices[0]!.customerName,
    customerCode: enrichedInvoices[0]!.customerCode,
    currency,
    issuerKey,
    fromYear: input.fromYear,
    fromMonth: input.fromMonth,
    toYear: input.toYear,
    toMonth: input.toMonth,
    periodLabel: buildPeriodLabel(
      input.fromYear,
      input.fromMonth,
      input.toYear,
      input.toMonth
    ),
    asOfDate,
    generatedAtLabel: formatArListingGeneratedAt(new Date()),
    userIdLabel: user.email?.trim() || user.id,
    statement,
    aging,
  };
}
