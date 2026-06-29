import type { CharterInvoiceData } from "@/lib/charter-invoice";
import { WtlExpressInvoiceLetterhead } from "@/components/shared/PrintLogo";
import { WtlTaxInvoiceTotals } from "@/components/documents/WtlTaxInvoiceTotals";
import {
  formatMoneyAmount,
  formatMoneyWithCurrency,
} from "@/lib/number-format";

interface CharterWtlInvoicePrintProps {
  data: CharterInvoiceData;
}

export function CharterWtlInvoicePrint({ data }: CharterWtlInvoicePrintProps) {
  const sst = data.wtlSst;
  if (!sst) {
    throw new Error("WTL invoice requires SST breakdown");
  }

  return (
    <div className="document-print mode4-tax-invoice-print haidee-market-invoice-print wtl-tax-invoice-document">
      <WtlExpressInvoiceLetterhead />

      <div className="mode4-tax-invoice-title">TAX INVOICE</div>
      <div className="header-sub">
        {data.billToDisplayLabel} · {data.dateLabel} · {data.currency}
      </div>

      <div className="monthly-invoice-meta">
        <div className="monthly-invoice-meta-info">
          <div>
            <strong>包车单号 Charter No:</strong> {data.charterNo}
          </div>
          <div>
            <strong>日期 Date:</strong> {data.dateLabel}
          </div>
          <div>
            <strong>币种 Currency:</strong> {data.currency}
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
        <div className="monthly-invoice-section-title">
          包车费用 Charter Charges
        </div>
        <table className="monthly-invoice-table mode4-tax-invoice-table">
          <thead>
            <tr>
              <th className="mode4-route-col">Description</th>
              <th className="mode4-amount-col">Amount (Incl. Tax)</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line, index) => (
              <tr key={`${line.description}-${index}`}>
                <td className="text-left">{line.description}</td>
                <td className="text-right">{formatMoneyAmount(line.amountMyr)}</td>
              </tr>
            ))}
            <tr className="monthly-invoice-section-total">
              <td className="text-right">Subtotal (Incl. Tax)</td>
              <td className="text-right">
                {formatMoneyWithCurrency(data.grandTotalMyr, data.currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <WtlTaxInvoiceTotals
        rows={[
          {
            label: "Sub Total (Excluding Tax)",
            amount: formatMoneyWithCurrency(sst.subTotalExTax, data.currency),
          },
          {
            label: `Service Tax @ 6% on ${formatMoneyAmount(sst.subTotalExTax)}`,
            amount: formatMoneyWithCurrency(sst.sstAmount, data.currency),
          },
          {
            label: "Total (Inclusive of Tax)",
            amount: formatMoneyWithCurrency(sst.totalInclusive, data.currency),
            grand: true,
          },
        ]}
      />

      <div className="signature-row">
        <span>Prepared by: _______________</span>
        <span>Approved by: _______________</span>
      </div>
    </div>
  );
}
