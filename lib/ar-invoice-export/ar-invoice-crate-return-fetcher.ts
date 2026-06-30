import { arDocNoPrefixForCrateReturnDebtor } from "@/lib/ar-invoice-export/ar-invoice-docno";
import type { ArInvoiceAmountSource } from "@/lib/ar-invoice-export/ar-invoice-row";
import {
  loadCrateReturnReceivableInvoicesForMonth,
  type ReceivableInvoice,
} from "@/lib/receivable-invoices";

export interface SkippedCrateReturnInvoice {
  entityKey: string;
  debtorCode: string | null;
  debtorName: string;
  reason: string;
}

export function mapReceivableInvoiceToArCrateReturnSource(
  invoice: ReceivableInvoice,
  year: number,
  month: number
): ArInvoiceAmountSource | null {
  if (invoice.invoiceType !== "crate_return") return null;
  if (!invoice.customerCode?.trim()) return null;
  if (invoice.totalAmount <= 0) return null;
  if (!arDocNoPrefixForCrateReturnDebtor(invoice.customerCode)) return null;

  return {
    revenueKind: "crate_return",
    entityKey: invoice.invoiceKey,
    debtorCode: invoice.customerCode.trim(),
    debtorName: invoice.customerName,
    year,
    month,
    amount: invoice.totalAmount,
    currency: "MYR",
  };
}

function skipReasonForCrateReturn(invoice: ReceivableInvoice): string | null {
  if (invoice.invoiceType !== "crate_return") return "非回桶月结单";
  if (!invoice.customerCode?.trim()) return "无客户 code";
  if (invoice.totalAmount <= 0) return "金额为 0";
  if (!arDocNoPrefixForCrateReturnDebtor(invoice.customerCode)) {
    return "DebtorCode 前缀未配置 DocNo 规则";
  }
  return null;
}

export async function fetchCrateReturnAmountsForMonth(
  year: number,
  month: number
): Promise<ArInvoiceAmountSource[]> {
  const result = await fetchCrateReturnAmountsForMonthWithSkips(year, month);
  return result.sources;
}

export async function fetchCrateReturnAmountsForMonthWithSkips(
  year: number,
  month: number
): Promise<{
  sources: ArInvoiceAmountSource[];
  skipped: SkippedCrateReturnInvoice[];
}> {
  const invoices = await loadCrateReturnReceivableInvoicesForMonth(year, month);
  const sources: ArInvoiceAmountSource[] = [];
  const skipped: SkippedCrateReturnInvoice[] = [];

  for (const invoice of invoices) {
    const mapped = mapReceivableInvoiceToArCrateReturnSource(
      invoice,
      year,
      month
    );
    if (mapped) {
      sources.push(mapped);
      continue;
    }
    const reason = skipReasonForCrateReturn(invoice);
    if (reason) {
      skipped.push({
        entityKey: invoice.invoiceKey,
        debtorCode: invoice.customerCode,
        debtorName: invoice.customerName,
        reason,
      });
    }
  }

  sources.sort((a, b) =>
    a.debtorCode.localeCompare(b.debtorCode, undefined, {
      sensitivity: "base",
    })
  );

  return { sources, skipped };
}
