import type { HaideeMonthlyInvoiceData } from "@/lib/monthly-invoice-mode-haidee";
import { INVOICE_COMPANY_HEADERS } from "@/lib/constants/monthly-invoice";
import { formatMoneyAmount, formatQty } from "@/lib/number-format";
import {
  formatHaideeInvoiceMoney,
  HaideeInvoiceDescriptionAmountTable,
  HaideeInvoiceGrandTotal,
  HaideeInvoiceMetaBlocks,
  HaideeInvoicePrintDocument,
  HaideeInvoicePrintHeader,
  HaideeInvoiceSignatureRow,
} from "@/components/documents/HaideeInvoicePrintLayout";

interface HaideeMarketInvoicePrintProps {
  data: HaideeMonthlyInvoiceData;
}

function billToLabel(role: HaideeMonthlyInvoiceData["billToRole"]) {
  return role === "consignee" ? "收货人 Consignee" : "寄货人 Shipper";
}

export function HaideeMarketInvoicePrint({ data }: HaideeMarketInvoicePrintProps) {
  const company = INVOICE_COMPANY_HEADERS[data.mode.issuerKey];
  const { summary } = data;

  return (
    <HaideeInvoicePrintDocument>
      <HaideeInvoicePrintHeader
        nameZh={company.nameZh}
        nameEn={company.nameEn}
        subtitle={`${data.customerName} · ${data.periodLabel} · ${data.currency}`}
      />

      <HaideeInvoiceMetaBlocks
        billToLabel={billToLabel(data.billToRole)}
        billToName={data.customerName}
        billToCode={data.customerCode}
        info={
          <>
            <div>
              <strong>账单月份 Period:</strong> {data.periodLabel}
            </div>
            <div>
              <strong>币种 Currency:</strong> {data.currency}
            </div>
          </>
        }
      />

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
                  <td className="text-right">{formatQty(row.quantity)}</td>
                  <td className="text-right">{formatMoneyAmount(row.unitRate)}</td>
                  <td className="text-right">{formatMoneyAmount(row.amount)}</td>
                </tr>
              ))}
              <tr className="monthly-invoice-section-total">
                <td className="text-right">{section.title} 小计 Subtotal</td>
                <td className="text-right">{formatQty(section.totalQty)}</td>
                <td />
                <td className="text-right">
                  {formatHaideeInvoiceMoney(section.totalAmount, data.currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      {(data.extraCharges?.length ?? 0) > 0 && (
        <HaideeInvoiceDescriptionAmountTable
          lines={(data.extraCharges ?? []).map((row) => ({
            description: row.description,
            amountMyr: row.amount,
          }))}
          amountHeader={`Amount (${data.currency})`}
        />
      )}

      <HaideeInvoiceGrandTotal
        amountMyr={summary.grandTotalAmount}
        currency={data.currency}
        labelColSpan={3}
      />

      <HaideeInvoiceSignatureRow />
    </HaideeInvoicePrintDocument>
  );
}
