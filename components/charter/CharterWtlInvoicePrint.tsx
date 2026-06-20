import type { CharterInvoiceData } from "@/lib/charter-invoice";
import { WtlExpressInvoiceLetterhead } from "@/components/shared/PrintLogo";
import { WtlTaxInvoiceTotals } from "@/components/documents/WtlTaxInvoiceTotals";

interface CharterWtlInvoicePrintProps {
  data: CharterInvoiceData;
}

function formatMoney(value: number, currency: string) {
  return `${value.toFixed(2)} ${currency}`;
}

export function CharterWtlInvoicePrint({ data }: CharterWtlInvoicePrintProps) {
  const sst = data.wtlSst;
  if (!sst) {
    throw new Error("WTL invoice requires SST breakdown");
  }

  return (
    <div className="document-print mode4-tax-invoice-print wtl-tax-invoice-document">
      <WtlExpressInvoiceLetterhead />

      <div className="mode4-tax-invoice-title">TAX INVOICE</div>
      <div className="header-sub">
        {data.billTo.name} · {data.dateLabel} · {data.currency}
      </div>

      <div className="monthly-invoice-meta">
        <div className="monthly-invoice-meta-info">
          <div>
            <strong>Charter No:</strong> {data.charterNo}
          </div>
          <div>
            <strong>Date:</strong> {data.dateLabel}
          </div>
          <div>
            <strong>Plate:</strong> {data.truckPlate}
          </div>
          <div>
            <strong>Cargo:</strong> {data.cargoTypeLabel}
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
              <th className="mode4-amount-col">Amount (Incl. Tax)</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line, index) => (
              <tr key={`${line.description}-${index}`}>
                <td className="text-left">{line.description}</td>
                <td className="text-right">{line.amountMyr.toFixed(2)}</td>
              </tr>
            ))}
            <tr className="monthly-invoice-section-total">
              <td className="text-right">Subtotal (Incl. Tax)</td>
              <td className="text-right">
                {formatMoney(data.grandTotalMyr, data.currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <WtlTaxInvoiceTotals
        rows={[
          {
            label: "Sub Total (Excluding Tax)",
            amount: formatMoney(sst.subTotalExTax, data.currency),
          },
          {
            label: `Service Tax @ 6% on ${sst.subTotalExTax.toFixed(2)}`,
            amount: formatMoney(sst.sstAmount, data.currency),
          },
          {
            label: "Total (Inclusive of Tax)",
            amount: formatMoney(sst.totalInclusive, data.currency),
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
