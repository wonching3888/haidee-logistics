import type { MonthlyInvoiceMode } from "@/lib/constants/monthly-invoice";
import {
  loadFreightReceivableInvoicesForMonth,
  type ReceivableInvoice,
} from "@/lib/receivable-invoices";
import type { ArInvoiceAmountSource } from "@/lib/ar-invoice-export/ar-invoice-row";

/** Filter freight receivable rows for one invoice mode (same pipeline as collections). */
export async function loadFreightReceivableInvoicesForMode(
  year: number,
  month: number,
  mode: MonthlyInvoiceMode
): Promise<ReceivableInvoice[]> {
  const invoices = await loadFreightReceivableInvoicesForMonth(year, month);
  return invoices.filter((invoice) => invoice.sourceMeta.mode === mode);
}

export function mapReceivableInvoiceToArFreightSource(
  invoice: ReceivableInvoice,
  year: number,
  month: number
): ArInvoiceAmountSource | null {
  if (invoice.invoiceType !== "freight") return null;
  const mode = invoice.sourceMeta.mode;
  if (!mode) return null;
  if (!invoice.customerCode?.trim()) return null;
  if (invoice.totalAmount <= 0) return null;

  return {
    revenueKind: "freight",
    entityKey: invoice.invoiceKey,
    mode,
    debtorCode: invoice.customerCode.trim(),
    debtorName: invoice.customerName,
    year,
    month,
    amount: invoice.totalAmount,
    currency: invoice.currency,
  };
}

/**
 * Loads monthly freight AR amounts from the receivable pipeline.
 * Amounts match invoice collections + print page (same invoiceKey / grandTotal).
 */
export async function fetchFreightAmountsForMonth(
  year: number,
  month: number,
  mode: MonthlyInvoiceMode
): Promise<ArInvoiceAmountSource[]> {
  const invoices = await loadFreightReceivableInvoicesForMode(
    year,
    month,
    mode
  );
  return invoices
    .map((invoice) =>
      mapReceivableInvoiceToArFreightSource(invoice, year, month)
    )
    .filter((row): row is ArInvoiceAmountSource => row != null)
    .sort((a, b) =>
      a.debtorCode.localeCompare(b.debtorCode, undefined, {
        sensitivity: "base",
      })
    );
}
