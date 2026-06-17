import type { MonthlyInvoiceData } from "@/lib/monthly-invoice";
import {
  INVOICE_COMPANY_HEADERS,
} from "@/lib/constants/monthly-invoice";
import { getPaymentModeLabel } from "@/lib/constants/freight-settings";
import { PrintCompanyHeader } from "@/components/shared/PrintLogo";
import "./document-print.css";

interface MonthlyInvoicePrintProps {
  data: MonthlyInvoiceData;
}

function formatMoney(value: number, currency: string) {
  return `${value.toFixed(2)} ${currency}`;
}

export function MonthlyInvoicePrint({ data }: MonthlyInvoicePrintProps) {
  const company = INVOICE_COMPANY_HEADERS[data.mode.issuerKey];
  const billToLabel =
    data.mode.billTo === "shipper" ? "寄货人 Shipper" : "收货人 Consignee";

  return (
    <div className="document-print monthly-invoice-print">
      <div className="header-title">{company.nameZh}</div>
      <PrintCompanyHeader className="header-sub">
        {company.nameEn}
      </PrintCompanyHeader>

      <div className="monthly-invoice-title">月结账单 Monthly Invoice</div>
      <div className="header-sub">{data.mode.labelEn}</div>

      <div className="monthly-invoice-meta">
        <div>
          <div>
            <strong>账单月份 Period:</strong> {data.periodLabel}
          </div>
          <div>
            <strong>付款模式 Payment Mode:</strong>{" "}
            {getPaymentModeLabel(data.mode.paymentMode)}
          </div>
          <div>
            <strong>币种 Currency:</strong> {data.currency}
          </div>
        </div>
        <div className="monthly-invoice-bill-to">
          <div className="monthly-invoice-bill-to-label">{billToLabel}</div>
          <div className="monthly-invoice-bill-to-name">{data.customerName}</div>
          <div className="monthly-invoice-bill-to-code">{data.customerCode}</div>
        </div>
      </div>

      {data.mode.sstNote && (
        <p className="monthly-invoice-note">
          * 费率已含 SST / Rates include SST
        </p>
      )}

      {data.sections.map((section) => (
        <div key={section.kind} className="monthly-invoice-section">
          <div className="monthly-invoice-section-title">{section.title}</div>
          <table className="monthly-invoice-table">
            <thead>
              <tr>
                <th className="monthly-invoice-date-col">日期 Date</th>
                <th className="monthly-invoice-stall-col">收货人 Receiver</th>
                <th className="monthly-invoice-market-col">市场 Market</th>
                <th className="monthly-invoice-type-col">桶款 Type</th>
                <th className="monthly-invoice-qty-col">桶数 Qty</th>
                <th className="monthly-invoice-rate-col">单价 Rate</th>
                <th className="monthly-invoice-subtotal-col">小计 Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {section.lines.map((line, index) => (
                <tr key={`${section.kind}-${index}`}>
                  <td>{line.dateLabel}</td>
                  <td className="text-left">{line.stallLabel}</td>
                  <td>{line.marketLabel}</td>
                  <td>{line.tongTypeCode}</td>
                  <td className="text-right">{line.quantity}</td>
                  <td className="text-right">
                    {line.unitRate.toFixed(2)}
                  </td>
                  <td className="text-right">
                    {line.subtotal.toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr className="monthly-invoice-section-total">
                <td colSpan={4} className="text-right">
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

      <table className="monthly-invoice-table monthly-invoice-grand-total">
        <tbody>
          <tr className="monthly-invoice-grand-row">
            <td colSpan={4} className="text-right">
              总计 Grand Total
            </td>
            <td className="text-right">{data.grandTotalQty}</td>
            <td />
            <td className="text-right">
              {formatMoney(data.grandTotalAmount, data.currency)}
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
