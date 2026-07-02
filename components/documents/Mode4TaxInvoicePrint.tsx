import type { WtlMonthlyInvoiceData } from "@/lib/monthly-invoice-mode4";
import { getWtlAccountingInvoiceDetails } from "@/lib/constants/wtl-company-details";
import { INVOICE_LISTING_CRATE_SECTION_TITLE } from "@/lib/monthly-invoice-aggregate";
import { formatInvoiceAmountInWords } from "@/lib/invoice-amount-words";
import { WtlExpressInvoiceLetterhead } from "@/components/shared/PrintLogo";
import { WtlTaxInvoiceTotals } from "@/components/documents/WtlTaxInvoiceTotals";
import {
  formatMoneyAmount,
  formatMoneyWithCurrency,
  formatQty,
} from "@/lib/number-format";

interface Mode4TaxInvoicePrintProps {
  data: WtlMonthlyInvoiceData;
  pageNumber?: number;
  pageCount?: number;
}

function billToLabel(role: WtlMonthlyInvoiceData["billToRole"]) {
  return role === "consignee" ? "收货人 Consignee" : "寄货人 Shipper";
}

function sectionDisplayTitle(kind: "tong" | "box", title: string) {
  if (kind === "tong") return INVOICE_LISTING_CRATE_SECTION_TITLE;
  return title;
}

export function Mode4TaxInvoicePrint({
  data,
  pageNumber = 1,
  pageCount = 2,
}: Mode4TaxInvoicePrintProps) {
  const { taxInvoice } = data;
  const extraCharges = data.extraCharges ?? [];
  const details = getWtlAccountingInvoiceDetails();
  const printMeta = data.accountingPrint;
  const amountInWords = formatInvoiceAmountInWords(
    taxInvoice.totals.totalInclusive,
    data.currency
  );

  return (
    <div className="document-print mode4-tax-invoice-print wtl-tax-invoice-document wtl-accounting-invoice-print">
      <WtlExpressInvoiceLetterhead />

      <div className="mode4-tax-invoice-title">TAX INVOICE</div>
      <div className="header-sub">
        {data.customerName} · {data.periodLabel} · {data.currency}
      </div>

      <div className="monthly-invoice-meta">
        <div className="monthly-invoice-meta-info">
          <div>
            <strong>Invoice No:</strong> {printMeta?.invoiceNo ?? "—"}
          </div>
          <div>
            <strong>Terms:</strong> {printMeta?.termsLabel ?? details.terms}
          </div>
          <div>
            <strong>Date:</strong> {printMeta?.invoiceDateLabel ?? "—"}
          </div>
          <div>
            <strong>账单月份 Period:</strong> {data.periodLabel}
          </div>
          <div>
            <strong>币种 Currency:</strong> {data.currency}
          </div>
        </div>
        <div className="monthly-invoice-bill-to">
          <div className="monthly-invoice-bill-to-label">
            {billToLabel(data.billToRole)}
          </div>
          <div className="monthly-invoice-bill-to-name">{data.customerName}</div>
          <div className="monthly-invoice-bill-to-code">{data.customerCode}</div>
        </div>
      </div>

      {taxInvoice.sections.map((section) => {
        const sectionTitle = sectionDisplayTitle(section.kind, section.title);
        return (
          <div key={section.kind} className="monthly-invoice-section">
            <div className="monthly-invoice-section-title">{sectionTitle}</div>
            <table className="monthly-invoice-table mode4-tax-invoice-table">
              <thead>
                <tr>
                  <th className="mode4-route-col">路线 Route</th>
                  <th className="mode4-tax-code-col">Tax Code</th>
                  <th className="mode4-qty-col">数量 Qty</th>
                  <th className="mode4-rate-col">单价 Rate</th>
                  <th className="mode4-amount-col">金额 Amount</th>
                </tr>
              </thead>
              <tbody>
                {section.thRow && (
                  <tr>
                    <td className="text-left">{section.thRow.routeLabel}</td>
                    <td />
                    <td className="text-right">{formatQty(section.thRow.quantity)}</td>
                    <td className="text-right">
                      {formatMoneyAmount(section.thRow.unitRate)}
                    </td>
                    <td className="text-right">
                      {formatMoneyAmount(section.thRow.amount)}
                    </td>
                  </tr>
                )}
                {section.myRows.map((row) => (
                  <tr key={`${section.kind}-${row.marketCode}`}>
                    <td className="text-left">{row.routeLabel}</td>
                    <td className="text-center">{row.taxCode}</td>
                    <td className="text-right">{formatQty(row.quantity)}</td>
                    <td className="text-right">{formatMoneyAmount(row.unitRate)}</td>
                    <td className="text-right">{formatMoneyAmount(row.amount)}</td>
                  </tr>
                ))}
                <tr className="monthly-invoice-section-total">
                  <td colSpan={2} className="text-right">
                    {sectionTitle} 小计 Subtotal
                  </td>
                  <td className="text-right">{formatQty(section.totalQty)}</td>
                  <td />
                  <td className="text-right">
                    {formatMoneyWithCurrency(section.totalAmount, data.currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

      {extraCharges.length > 0 && (
        <div className="monthly-invoice-section">
          <div className="monthly-invoice-section-title">
            额外收费 Extra Charges
          </div>
          <table className="monthly-invoice-table mode4-tax-invoice-table">
            <thead>
              <tr>
                <th className="mode4-route-col">说明 Description</th>
                <th className="mode4-tax-code-col">Tax Code</th>
                <th className="mode4-qty-col">数量 Qty</th>
                <th className="mode4-rate-col">单价 Rate</th>
                <th className="mode4-amount-col">金额 Amount</th>
              </tr>
            </thead>
            <tbody>
              {extraCharges.map((row) => (
                <tr key={row.id}>
                  <td className="text-left">{row.description}</td>
                  <td className="text-center">ESV-6</td>
                  <td className="text-right">1</td>
                  <td className="text-right">{formatMoneyAmount(row.amount)}</td>
                  <td className="text-right">{formatMoneyAmount(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <WtlTaxInvoiceTotals
        rows={[
          {
            label: "Sub Total (Excluding Tax)",
            amount: formatMoneyWithCurrency(
              taxInvoice.totals.subTotalExcludingTax,
              data.currency
            ),
          },
          {
            label: `Service Tax @ 6% on ${formatMoneyAmount(taxInvoice.totals.sstBase)}`,
            amount: formatMoneyWithCurrency(
              taxInvoice.totals.sstAmount,
              data.currency
            ),
          },
          {
            label: "Total (Inclusive of Tax)",
            amount: formatMoneyWithCurrency(
              taxInvoice.totals.totalInclusive,
              data.currency
            ),
            grand: true,
          },
        ]}
      />

      <div className="mode4-tax-summary">
        <div className="mode4-tax-summary-title">Tax Summary</div>
        <table className="monthly-invoice-table mode4-tax-summary-table">
          <thead>
            <tr>
              <th className="text-left">Description</th>
              <th className="mode4-tax-base-col">Tax Base</th>
              <th className="mode4-tax-amount-col">Tax Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-left">Service Tax @ 6%</td>
              <td className="text-right">
                {formatMoneyAmount(taxInvoice.taxSummary.sstBase)}
              </td>
              <td className="text-right">
                {formatMoneyAmount(taxInvoice.taxSummary.sstAmount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mode1a-invoice-amount-words">{amountInWords}</div>

      <div className="mode1a-invoice-bank">
        <strong>Bank Account:</strong> {details.bankAccount}
      </div>
      <div className="mode1a-invoice-bank-notes">{details.bankNotes}</div>

      <div className="mode1a-invoice-computer-note">
        {details.computerGeneratedNote}
      </div>

      <div className="invoice-page-footer">
        Page {pageNumber} of {pageCount}
      </div>
    </div>
  );
}
