import type { HaideeMonthlyInvoiceData } from "@/lib/monthly-invoice-mode-haidee";
import { HAIDEE_MODE1A_INVOICE_DETAILS } from "@/lib/constants/haidee-company-details";
import { INVOICE_COMPANY_HEADERS } from "@/lib/constants/monthly-invoice";
import { getMode1aInvoiceRouteLabel } from "@/lib/constants/invoice-route-labels";
import { formatInvoiceAmountInWords } from "@/lib/invoice-amount-words";
import { formatMoneyAmount, formatQty } from "@/lib/number-format";
import {
  formatHaideeInvoiceMoney,
  HaideeInvoiceDescriptionAmountTable,
  HaideeInvoiceGrandTotal,
  HaideeInvoiceMetaBlocks,
  HaideeInvoicePrintDocument,
  HaideeInvoicePrintHeader,
} from "@/components/documents/HaideeInvoicePrintLayout";

function mode1aSectionTitle(kind: "tong" | "box", fallback: string) {
  if (kind === "tong") return "桶 / Crate";
  return fallback;
}

interface Mode1aTaxInvoicePrintProps {
  data: HaideeMonthlyInvoiceData;
  pageNumber?: number;
  pageCount?: number;
}

export function Mode1aTaxInvoicePrint({
  data,
  pageNumber = 1,
  pageCount = 2,
}: Mode1aTaxInvoicePrintProps) {
  const company = INVOICE_COMPANY_HEADERS.haidee;
  const details = HAIDEE_MODE1A_INVOICE_DETAILS;
  const printMeta = data.mode1aPrint;
  const { summary } = data;
  const amountInWords = formatInvoiceAmountInWords(
    summary.grandTotalAmount,
    data.currency
  );

  return (
    <HaideeInvoicePrintDocument framed className="mode1a-invoice-print">
      <HaideeInvoicePrintHeader
        nameZh={company.nameZh}
        nameEn={company.nameEn}
        nameTh="บริษัท ไฮดี โลจิสติกส์ จำกัด"
        addressLines={[...details.addressLines]}
        phone={details.phone}
        taxId={`Registration No.: ${details.registrationNo}`}
        subtitle={`${data.customerName} · ${data.periodLabel} · ${data.currency}`}
      />

      <HaideeInvoiceMetaBlocks
        billToLabel="寄货人 Shipper"
        billToName={data.customerName}
        billToCode={data.customerCode}
        info={
          <>
            <div>
              <strong>Invoice No:</strong> {printMeta?.invoiceNo ?? "—"}
            </div>
            <div>
              <strong>Terms:</strong> {printMeta?.termsLabel ?? details.terms}
            </div>
            <div>
              <strong>Date:</strong> {printMeta?.invoiceDateLabel ?? "—"}
            </div>
            <div>
              <strong>账单月份 Period:</strong> {data.periodLabel}
            </div>
            <div>
              <strong>币种 Currency:</strong> {data.currency}
            </div>
          </>
        }
      />

      {summary.sections.map((section) => {
        const sectionTitle = mode1aSectionTitle(section.kind, section.title);
        return (
        <div key={section.kind} className="monthly-invoice-section">
          <div className="monthly-invoice-section-title">{sectionTitle}</div>
          <table className="monthly-invoice-table mode4-tax-invoice-table">
            <thead>
              <tr>
                <th className="mode4-route-col">Description</th>
                <th className="mode4-qty-col">数量 Qty</th>
                <th className="mode4-rate-col">单价 Rate</th>
                <th className="mode4-amount-col">金额 Amount</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => (
                <tr key={`${section.kind}-${row.marketCode}`}>
                  <td className="text-left">
                    {getMode1aInvoiceRouteLabel(row.marketCode)}
                  </td>
                  <td className="text-right">{formatQty(row.quantity)}</td>
                  <td className="text-right">{formatMoneyAmount(row.unitRate)}</td>
                  <td className="text-right">{formatMoneyAmount(row.amount)}</td>
                </tr>
              ))}
              <tr className="monthly-invoice-section-total">
                <td className="text-right">{sectionTitle} 小计 Subtotal</td>
                <td className="text-right">{formatQty(section.totalQty)}</td>
                <td />
                <td className="text-right">
                  {formatHaideeInvoiceMoney(section.totalAmount, data.currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        );
      })}

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

      <div className="mode1a-invoice-amount-words">{amountInWords}</div>

      <div className="mode1a-invoice-bank">
        <strong>Bank Account:</strong> {details.bankAccount}
      </div>

      <div className="mode1a-invoice-computer-note">
        {details.computerGeneratedNote}
      </div>

      <div className="invoice-page-footer">
        Page {pageNumber} of {pageCount}
      </div>
    </HaideeInvoicePrintDocument>
  );
}
