import type { CrateReturnMonthlyInvoicePrintData } from "@/lib/crate-return-billing";
import { INVOICE_COMPANY_HEADERS } from "@/lib/constants/monthly-invoice";
import {
  formatMoneyAmount,
  formatMoneyWithCurrency,
  formatQty,
} from "@/lib/number-format";
import { PrintLetterhead } from "@/components/shared/PrintLogo";
import "./document-print.css";

interface CrateReturnMonthlyInvoicePrintProps {
  data: CrateReturnMonthlyInvoicePrintData;
}

export function CrateReturnMonthlyInvoicePrint({
  data,
}: CrateReturnMonthlyInvoicePrintProps) {
  const company = INVOICE_COMPANY_HEADERS.haidee;
  const hasCollection = data.collectionRateMyr > 0;

  return (
    <div className="document-print haidee-market-invoice-print crate-return-invoice-print haidee-charter-invoice-document">
      <PrintLetterhead nameZh={company.nameZh} nameEn={company.nameEn} />

      <div className="mode4-tax-invoice-title">INVOICE</div>
      <div className="header-sub">
        {data.billToName} · {data.periodLabel} · {data.currency}
      </div>

      <div className="monthly-invoice-meta">
        <div className="monthly-invoice-meta-info">
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

      <div className="monthly-invoice-section">
        <div className="monthly-invoice-section-title">
          回收明细 Crate Return Details
        </div>
        <table className="monthly-invoice-table">
          <thead>
            <tr>
              <th className="monthly-invoice-date-col">日期 Date</th>
              <th className="monthly-invoice-plate-col">车牌 Plate</th>
              <th className="monthly-invoice-market-col">市场 Market</th>
              <th className="monthly-invoice-type-col">桶型 Type</th>
              <th className="monthly-invoice-qty-col">桶数 Qty</th>
              <th className="monthly-invoice-rate-col">单价 Rate</th>
              <th className="monthly-invoice-subtotal-col">金额 Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.detailRows.map((row, index) => (
              <tr
                key={`${row.tripKey}-${row.chargeKind}-${index}`}
                className="text-left"
              >
                <td className="text-left">{row.tripDateLabel}</td>
                <td className="text-left font-mono">{row.truckPlate}</td>
                <td className="text-left">
                  <div>{row.marketLabel}</div>
                  {row.chargeLabel ? (
                    <div className="text-[8pt] font-normal leading-tight">
                      {row.chargeLabel}
                    </div>
                  ) : null}
                </td>
                <td className="text-left">{row.crateType}</td>
                <td className="text-right">{formatQty(row.quantity)}</td>
                <td className="text-right">{formatMoneyAmount(row.unitRateMyr)}</td>
                <td className="text-right">{formatMoneyAmount(row.amountMyr)}</td>
              </tr>
            ))}

            {hasCollection ? (
              <>
                <tr className="monthly-invoice-section-total">
                  <td className="text-right" colSpan={4}>
                    车力费小计 Freight Subtotal
                  </td>
                  <td className="text-right">{formatQty(data.quantity)}</td>
                  <td />
                  <td className="text-right">
                    {formatMoneyWithCurrency(data.freightAmountMyr, data.currency)}
                  </td>
                </tr>
                <tr className="monthly-invoice-section-total">
                  <td className="text-right" colSpan={4}>
                    收桶费小计 Collection Subtotal
                  </td>
                  <td className="text-right">{formatQty(data.quantity)}</td>
                  <td />
                  <td className="text-right">
                    {formatMoneyWithCurrency(data.collectionAmountMyr, data.currency)}
                  </td>
                </tr>
              </>
            ) : (
              <tr className="monthly-invoice-section-total">
                <td className="text-right" colSpan={4}>
                  小计 Subtotal
                </td>
                <td className="text-right">{formatQty(data.quantity)}</td>
                <td />
                <td className="text-right">
                  {formatMoneyWithCurrency(data.freightAmountMyr, data.currency)}
                </td>
              </tr>
            )}

            <tr className="monthly-invoice-grand-row">
              <td className="text-right" colSpan={6}>
                总计 Grand Total
              </td>
              <td className="text-right">
                {formatMoneyWithCurrency(data.totalAmountMyr, data.currency)}
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
