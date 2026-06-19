import type { HaideeMonthlyInvoiceData } from "@/lib/monthly-invoice-mode-haidee";
import { INVOICE_COMPANY_HEADERS } from "@/lib/constants/monthly-invoice";
import { PrintLetterhead } from "@/components/shared/PrintLogo";

interface HaideeMarketInvoicePrintProps {
  data: HaideeMonthlyInvoiceData;
}

function formatMoney(value: number, currency: string) {
  return `${value.toFixed(2)} ${currency}`;
}

function billToLabel(role: HaideeMonthlyInvoiceData["billToRole"]) {
  return role === "consignee" ? "收货人 Consignee" : "寄货人 Shipper";
}

export function HaideeMarketInvoicePrint({ data }: HaideeMarketInvoicePrintProps) {
  const company = INVOICE_COMPANY_HEADERS[data.mode.issuerKey];
  const { summary } = data;

  return (
    <div className="document-print haidee-market-invoice-print">
      <PrintLetterhead nameZh={company.nameZh} nameEn={company.nameEn} />

      <div className="mode4-tax-invoice-title">INVOICE</div>
      <div className="header-sub">
        {data.customerName} · {data.periodLabel} · {data.currency}
      </div>

      <div className="monthly-invoice-meta">
        <div>
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

      {summary.sections.map((section) => (
        <div key={section.kind} className="monthly-invoice-section">
          <div className="monthly-invoice-section-title">{section.title}</div>
          <table className="monthly-invoice-table mode4-tax-invoice-table">
            <thead>
              <tr>
                <th className="mode4-route-col">市场 Market</th>
                <th className="mode4-qty-col">数量 Qty</th>
                <th className="mode4-rate-col">单价 Rate</th>
                <th className="mode4-amount-col">金额 Amount</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => (
                <tr key={`${section.kind}-${row.marketCode}`}>
                  <td className="text-left">{row.marketLabel}</td>
                  <td className="text-right">{row.quantity}</td>
                  <td className="text-right">{row.unitRate.toFixed(2)}</td>
                  <td className="text-right">{row.amount.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="monthly-invoice-section-total">
                <td className="text-right">{section.title} 小计 Subtotal</td>
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
          <tr className="monthly-invoice-grand-row">
            <td className="text-right" colSpan={3}>
              总计 Grand Total
            </td>
            <td className="text-right">
              {formatMoney(summary.grandTotalAmount, data.currency)}
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
