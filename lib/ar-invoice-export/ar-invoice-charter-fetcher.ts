import type { ArInvoiceAmountSource } from "@/lib/ar-invoice-export/ar-invoice-row";
import {
  loadCharterReceivableInvoicesForMonth,
  type ReceivableInvoice,
} from "@/lib/receivable-invoices";

export interface SkippedCharterInvoice {
  entityKey: string;
  charterNo: string | null;
  customerName: string;
  tripDate: string;
  reason: string;
}

export function mapReceivableInvoiceToArCharterSource(
  invoice: ReceivableInvoice,
  year: number,
  month: number
): ArInvoiceAmountSource | null {
  if (invoice.invoiceType !== "charter") return null;
  if (invoice.customerKind === "charter_manual") return null;
  if (!invoice.customerCode?.trim()) return null;
  if (invoice.totalAmount <= 0) return null;

  return {
    revenueKind: "charter",
    entityKey: invoice.invoiceKey,
    mode: "charter",
    debtorCode: invoice.customerCode.trim(),
    debtorName: invoice.customerName,
    year,
    month,
    tripDate: invoice.sortDate,
    amount: invoice.totalAmount,
    currency: "MYR",
  };
}

function skipReasonForCharter(invoice: ReceivableInvoice): string | null {
  if (invoice.invoiceType !== "charter") return "非包车 Invoice";
  if (invoice.customerKind === "charter_manual" || !invoice.customerCode?.trim()) {
    return "无客户 code（手动输入名字）";
  }
  if (invoice.totalAmount <= 0) return "金额为 0";
  return null;
}

export async function fetchCharterAmountsForMonth(
  year: number,
  month: number
): Promise<ArInvoiceAmountSource[]> {
  const result = await fetchCharterAmountsForMonthWithSkips(year, month);
  return result.sources;
}

export async function fetchCharterAmountsForMonthWithSkips(
  year: number,
  month: number
): Promise<{
  sources: ArInvoiceAmountSource[];
  skipped: SkippedCharterInvoice[];
}> {
  const invoices = await loadCharterReceivableInvoicesForMonth(year, month);
  const sources: ArInvoiceAmountSource[] = [];
  const skipped: SkippedCharterInvoice[] = [];

  for (const invoice of invoices) {
    const mapped = mapReceivableInvoiceToArCharterSource(invoice, year, month);
    if (mapped) {
      sources.push(mapped);
      continue;
    }
    const reason = skipReasonForCharter(invoice);
    if (reason) {
      skipped.push({
        entityKey: invoice.invoiceKey,
        charterNo: invoice.invoiceNo,
        customerName: invoice.customerName,
        tripDate: invoice.sortDate,
        reason,
      });
    }
  }

  sources.sort((a, b) => {
    const dateCmp = (a.tripDate ?? "").localeCompare(b.tripDate ?? "");
    if (dateCmp !== 0) return dateCmp;
    return a.debtorCode.localeCompare(b.debtorCode, undefined, {
      sensitivity: "base",
    });
  });

  return { sources, skipped };
}
