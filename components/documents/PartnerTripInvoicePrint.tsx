import type { PartnerTripInvoicePrintData } from "@/lib/partner-freight";
import { WtlExpressInvoiceLetterhead } from "@/components/shared/PrintLogo";

interface PartnerTripInvoicePrintProps {
  data: PartnerTripInvoicePrintData;
}

function formatMoney(value: number, currency: string) {
  return `${value.toFixed(2)} ${currency}`;
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
              <td className="text-right">{data.quantity}</td>
              <td className="text-right">{data.unitRateMyr.toFixed(2)}</td>
              <td className="text-right">{data.amountMyr.toFixed(2)}</td>
            </tr>
            <tr className="monthly-invoice-section-total">
              <td colSpan={2} className="text-right">
                Subtotal
              </td>
              <td className="text-right">{data.quantity}</td>
              <td />
              <td className="text-right">
                {formatMoney(data.amountMyr, data.currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <table className="monthly-invoice-table mode4-tax-invoice-totals">
        <tbody>
          <tr>
            <td className="text-right" colSpan={4}>
              Sub Total (Excluding Tax)
            </td>
            <td className="text-right">
              {formatMoney(data.amountMyr, data.currency)}
            </td>
          </tr>
          <tr>
            <td className="text-right" colSpan={4}>
              Service Tax @ {taxPercent}% on {data.amountMyr.toFixed(2)}
            </td>
            <td className="text-right">
              {formatMoney(data.taxAmountMyr, data.currency)}
            </td>
          </tr>
          <tr className="monthly-invoice-grand-row">
            <td className="text-right" colSpan={4}>
              Total (Inclusive of Tax)
            </td>
            <td className="text-right">
              {formatMoney(data.totalMyr, data.currency)}
            </td>
          </tr>
        </tbody>
      </table>

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
              <td className="text-right">{data.amountMyr.toFixed(2)}</td>
              <td className="text-right">{data.taxAmountMyr.toFixed(2)}</td>
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
