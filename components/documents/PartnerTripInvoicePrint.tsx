import type { PartnerTripInvoicePrintData } from "@/lib/partner-freight";
import { WtlExpressInvoiceLetterhead } from "@/components/shared/PrintLogo";
import { WtlTaxInvoiceTotals } from "@/components/documents/WtlTaxInvoiceTotals";
import {
  formatMoneyAmount,
  formatMoneyWithCurrency,
  formatQty,
} from "@/lib/number-format";

interface PartnerTripInvoicePrintProps {
  data: PartnerTripInvoicePrintData;
}

export function PartnerTripInvoicePrint({ data }: PartnerTripInvoicePrintProps) {
  const taxPercent = roundPercent(data.taxRate);

  return (
    <div className="document-print mode4-tax-invoice-print partner-trip-invoice-print wtl-tax-invoice-document">
      <WtlExpressInvoiceLetterhead />

      <div className="mode4-tax-invoice-title">TAX INVOICE</div>
      <div className="header-sub">
        {data.billToName} · {data.invoiceDateLabel} · {data.currency}
      </div>

      <div className="monthly-invoice-meta">
        <div className="monthly-invoice-meta-info">
          <div>
            <strong>Invoice No:</strong> {data.invoiceNo}
          </div>
          <div>
            <strong>Date:</strong> {data.invoiceDateLabel}
          </div>
          <div>
            <strong>Plate / Market:</strong> {data.truckPlate} · {data.marketLabel}
          </div>
          <div>
            <strong>Currency:</strong> {data.currency}
          </div>
        </div>
        <div className="monthly-invoice-bill-to">
          <div className="monthly-invoice-bill-to-label">Bill To</div>
          <div className="monthly-invoice-bill-to-name">{data.billToName}</div>
          <div className="monthly-invoice-bill-to-code">{data.billToCode}</div>
          {data.billToLocation ? (
            <div className="whitespace-pre-line text-sm text-haidee-muted">
              {data.billToLocation}
            </div>
          ) : null}
        </div>
      </div>

      <div className="monthly-invoice-section">
        <table className="monthly-invoice-table mode4-tax-invoice-table">
          <thead>
            <tr>
              <th className="mode4-route-col">Description</th>
              <th className="mode4-tax-code-col">Tax Code</th>
              <th className="mode4-qty-col">Qty</th>
              <th className="mode4-rate-col">Rate</th>
              <th className="mode4-amount-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-left">{data.lineDescription}</td>
              <td className="text-center">{data.taxCode}</td>
              <td className="text-right">{formatQty(data.quantity)}</td>
              <td className="text-right">{formatMoneyAmount(data.unitRateMyr)}</td>
              <td className="text-right">{formatMoneyAmount(data.amountMyr)}</td>
            </tr>
            <tr className="monthly-invoice-section-total">
              <td colSpan={2} className="text-right">
                Subtotal
              </td>
              <td className="text-right">{formatQty(data.quantity)}</td>
              <td />
              <td className="text-right">
                {formatMoneyWithCurrency(data.amountMyr, data.currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <WtlTaxInvoiceTotals
        rows={[
          {
            label: "Sub Total (Excluding Tax)",
            amount: formatMoneyWithCurrency(data.amountMyr, data.currency),
          },
          {
            label: `Service Tax @ ${taxPercent}% on ${formatMoneyAmount(data.amountMyr)}`,
            amount: formatMoneyWithCurrency(data.taxAmountMyr, data.currency),
          },
          {
            label: "Total (Inclusive of Tax)",
            amount: formatMoneyWithCurrency(data.totalMyr, data.currency),
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
              <td className="text-left">
                Service Tax @ {taxPercent}% ({data.taxCode})
              </td>
              <td className="text-right">{formatMoneyAmount(data.amountMyr)}</td>
              <td className="text-right">{formatMoneyAmount(data.taxAmountMyr)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="signature-row">
        <span>Prepared by: _______________</span>
        <span>Approved by: _______________</span>
      </div>
    </div>
  );
}

function roundPercent(rate: number) {
  return Math.round(rate * 10000) / 100;
}
