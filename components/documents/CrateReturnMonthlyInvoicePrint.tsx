import type { CrateReturnMonthlyInvoicePrintData } from "@/lib/crate-return-billing";
import { INVOICE_COMPANY_HEADERS } from "@/lib/constants/monthly-invoice";
import { PrintLetterhead } from "@/components/shared/PrintLogo";

interface CrateReturnMonthlyInvoicePrintProps {
  data: CrateReturnMonthlyInvoicePrintData;
}

function formatMoney(value: number, currency: string) {
  return `${value.toFixed(2)} ${currency}`;
}

export function CrateReturnMonthlyInvoicePrint({
  data,
}: CrateReturnMonthlyInvoicePrintProps) {
  const company = INVOICE_COMPANY_HEADERS.haidee;

  return (
    <div className="document-print haidee-market-invoice-print crate-return-invoice-print">
      <PrintLetterhead nameZh={company.nameZh} nameEn={company.nameEn} />

      <div className="mode4-tax-invoice-title">INVOICE</div>
      <div className="header-sub">
        {data.billToName} · {data.periodLabel} · {data.currency}
      </div>

      <div className="monthly-invoice-meta">
        <div>
          <div>
            <strong>Invoice No:</strong> {data.invoiceNo}
          </div>
          <div>
            <strong>Period:</strong> {data.periodLabel}
          </div>
          <div>
            <strong>Crate Type:</strong> {data.crateType}
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

      {data.sections.map((section) => (
        <div key={section.kind} className="monthly-invoice-section">
          <div className="monthly-invoice-section-title">{section.title}</div>
          <table className="monthly-invoice-table mode4-tax-invoice-table">
            <thead>
              <tr>
                <th className="mode4-route-col">Description</th>
                <th className="mode4-route-col">市场 Market</th>
                <th className="mode4-qty-col">Qty</th>
                <th className="mode4-rate-col">Rate</th>
                <th className="mode4-amount-col">Amount</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => (
                <tr key={`${section.kind}-${row.marketCode}`}>
                  <td className="text-left">{section.lineDescription}</td>
                  <td className="text-left">{row.marketLabel}</td>
                  <td className="text-right">{row.quantity}</td>
                  <td className="text-right">{row.unitRateMyr.toFixed(2)}</td>
                  <td className="text-right">{row.amountMyr.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="monthly-invoice-section-total">
                <td className="text-right" colSpan={2}>
                  {section.title} 小计 Subtotal
                </td>
                <td className="text-right">{section.totalQty}</td>
                <td />
                <td className="text-right">
                  {formatMoney(section.totalAmountMyr, data.currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      <table className="monthly-invoice-table mode4-tax-invoice-totals">
        <tbody>
          <tr className="monthly-invoice-grand-row">
            <td className="text-right" colSpan={4}>
              总计 Grand Total
            </td>
            <td className="text-right">
              {formatMoney(data.totalAmountMyr, data.currency)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="signature-row">
        <span>Prepared by: _______________</span>
        <span>Approved by: _______________</span>
      </div>
    </div>
  );
}
