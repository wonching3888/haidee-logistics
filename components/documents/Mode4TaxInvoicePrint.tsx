import type { WtlMonthlyInvoiceData } from "@/lib/monthly-invoice-mode4";
import { WtlExpressInvoiceLetterhead } from "@/components/shared/PrintLogo";

interface Mode4TaxInvoicePrintProps {
  data: WtlMonthlyInvoiceData;
}

function formatMoney(value: number, currency: string) {
  return `${value.toFixed(2)} ${currency}`;
}

function billToLabel(role: WtlMonthlyInvoiceData["billToRole"]) {
  return role === "consignee" ? "收货人 Consignee" : "寄货人 Shipper";
}

export function Mode4TaxInvoicePrint({ data }: Mode4TaxInvoicePrintProps) {
  const { taxInvoice } = data;

  return (
    <div className="document-print mode4-tax-invoice-print wtl-tax-invoice-document">
      <WtlExpressInvoiceLetterhead />

      <div className="mode4-tax-invoice-title">TAX INVOICE</div>
      <div className="header-sub">
        {data.customerName} · {data.periodLabel} · {data.currency}
      </div>

      <div className="monthly-invoice-meta">
        <div className="monthly-invoice-meta-info">
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

      {taxInvoice.sections.map((section) => (
        <div key={section.kind} className="monthly-invoice-section">
          <div className="monthly-invoice-section-title">{section.title}</div>
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
                  <td className="text-right">{section.thRow.quantity}</td>
                  <td className="text-right">
                    {section.thRow.unitRate.toFixed(2)}
                  </td>
                  <td className="text-right">
                    {section.thRow.amount.toFixed(2)}
                  </td>
                </tr>
              )}
              {section.myRows.map((row) => (
                <tr key={`${section.kind}-${row.marketCode}`}>
                  <td className="text-left">{row.routeLabel}</td>
                  <td className="text-center">{row.taxCode}</td>
                  <td className="text-right">{row.quantity}</td>
                  <td className="text-right">{row.unitRate.toFixed(2)}</td>
                  <td className="text-right">{row.amount.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="monthly-invoice-section-total">
                <td colSpan={2} className="text-right">
                  {section.title} 小计 Subtotal
                </td>
                <td className="text-right">{section.totalQty}</td>
                <td />
                <td className="text-right">
                  {formatMoney(section.totalAmount, data.currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      <table className="monthly-invoice-table mode4-tax-invoice-totals">
        <tbody>
          <tr>
            <td className="text-right" colSpan={4}>
              Sub Total (Excluding Tax)
            </td>
            <td className="text-right">
              {formatMoney(taxInvoice.totals.subTotalExcludingTax, data.currency)}
            </td>
          </tr>
          <tr>
            <td className="text-right" colSpan={4}>
              Service Tax @ 6% on{" "}
              {taxInvoice.totals.sstBase.toFixed(2)}
            </td>
            <td className="text-right">
              {formatMoney(taxInvoice.totals.sstAmount, data.currency)}
            </td>
          </tr>
          <tr className="monthly-invoice-grand-row">
            <td className="text-right" colSpan={4}>
              Total (Inclusive of Tax)
            </td>
            <td className="text-right">
              {formatMoney(taxInvoice.totals.totalInclusive, data.currency)}
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
              <td className="text-left">Service Tax @ 6%</td>
              <td className="text-right">
                {taxInvoice.taxSummary.sstBase.toFixed(2)}
              </td>
              <td className="text-right">
                {taxInvoice.taxSummary.sstAmount.toFixed(2)}
              </td>
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
