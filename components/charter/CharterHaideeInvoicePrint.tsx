import type { CharterInvoiceData } from "@/lib/charter-invoice";
import { INVOICE_COMPANY_HEADERS } from "@/lib/constants/monthly-invoice";
import { PrintLetterhead } from "@/components/shared/PrintLogo";

interface CharterHaideeInvoicePrintProps {
  data: CharterInvoiceData;
}

function formatMoney(value: number, currency: string) {
  return `${value.toFixed(2)} ${currency}`;
}

export function CharterHaideeInvoicePrint({ data }: CharterHaideeInvoicePrintProps) {
  const company = INVOICE_COMPANY_HEADERS.haidee;

  return (
    <div className="document-print haidee-market-invoice-print">
      <PrintLetterhead nameZh={company.nameZh} nameEn={company.nameEn} />

      <div className="mode4-tax-invoice-title">INVOICE</div>
      <div className="header-sub">
        {data.billTo.name} · {data.dateLabel} · {data.currency}
      </div>

      <div className="monthly-invoice-meta">
        <div>
          <div>
            <strong>包车单号 Charter No:</strong> {data.charterNo}
          </div>
          <div>
            <strong>日期 Date:</strong> {data.dateLabel}
          </div>
          <div>
            <strong>车牌 Truck:</strong> {data.truckPlate}
          </div>
          <div>
            <strong>货类 Cargo:</strong> {data.cargoTypeLabel}
          </div>
        </div>
        <div className="monthly-invoice-bill-to">
          <div className="monthly-invoice-bill-to-label">Bill To</div>
          <div className="monthly-invoice-bill-to-name">{data.billTo.name}</div>
          {data.billTo.code ? (
            <div className="monthly-invoice-bill-to-code">{data.billTo.code}</div>
          ) : null}
          {data.billTo.location ? (
            <div className="whitespace-pre-line text-sm text-haidee-muted">
              {data.billTo.location}
            </div>
          ) : null}
        </div>
      </div>

      <div className="monthly-invoice-section">
        <table className="monthly-invoice-table mode4-tax-invoice-table">
          <thead>
            <tr>
              <th className="mode4-route-col">Description</th>
              <th className="mode4-amount-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line, index) => (
              <tr key={`${line.description}-${index}`}>
                <td className="text-left">{line.description}</td>
                <td className="text-right">{line.amountMyr.toFixed(2)}</td>
              </tr>
            ))}
            <tr className="monthly-invoice-grand-row">
              <td className="text-right">Grand Total 总计</td>
              <td className="text-right">
                {formatMoney(data.grandTotalMyr, data.currency)}
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
