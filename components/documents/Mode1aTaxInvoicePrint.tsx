import type { HaideeMonthlyInvoiceData } from "@/lib/monthly-invoice-mode-haidee";
import { getHaideeAccountingInvoiceDetails } from "@/lib/constants/haidee-company-details";
import type { HaideeAccountingInvoiceMode } from "@/lib/constants/haidee-company-details";
import {
  formatMode1aBankAccountLine,
  resolveMode1aIssuerPrint,
} from "@/lib/constants/mode1a-invoice-issuer-print";
import { INVOICE_COMPANY_HEADERS } from "@/lib/constants/monthly-invoice";
import { getHaideeAccountingInvoiceRouteLabel } from "@/lib/constants/invoice-route-labels";
import { formatInvoiceAmountInWords } from "@/lib/invoice-amount-words";
import { formatMoneyAmount, formatQty } from "@/lib/number-format";
import {
  formatHaideeInvoiceMoney,
  HaideeInvoiceExtraChargesTable,
  HaideeInvoiceGrandTotal,
  HaideeInvoiceMetaBlocks,
  HaideeInvoicePrintDocument,
  HaideeInvoicePrintHeader,
} from "@/components/documents/HaideeInvoicePrintLayout";

function accountingSectionTitle(kind: "tong" | "box", fallback: string) {
  if (kind === "tong") return "桶 / Crate";
  return fallback;
}

function resolveAccountingPrint(data: HaideeMonthlyInvoiceData) {
  return data.accountingPrint ?? data.mode1aPrint;
}

function resolveAccountingMode(data: HaideeMonthlyInvoiceData): HaideeAccountingInvoiceMode {
  if (data.mode.value === "1b") return "1b";
  if (data.mode.value === "2") return "2";
  return "1a";
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
  const mode = resolveAccountingMode(data);
  const mode1aIssuer =
    mode === "1a" ? resolveMode1aIssuerPrint(data.invoiceCompany) : null;
  const company = mode1aIssuer ?? {
    nameZh: INVOICE_COMPANY_HEADERS.haidee.nameZh,
    nameEn: INVOICE_COMPANY_HEADERS.haidee.nameEn,
    nameTh: undefined as string | undefined,
  };
  const details =
    mode1aIssuer ?? getHaideeAccountingInvoiceDetails(mode);
  const bankAccountLine =
    mode === "1a" && mode1aIssuer
      ? formatMode1aBankAccountLine(mode1aIssuer)
      : details.bankAccount;
  const printMeta = resolveAccountingPrint(data);
  const { summary } = data;
  const extraCharges = data.extraCharges ?? [];
  const amountInWords = formatInvoiceAmountInWords(
    summary.grandTotalAmount,
    data.currency
  );

  return (
    <HaideeInvoicePrintDocument
      framed
      className="haidee-accounting-invoice-print mode1a-invoice-print"
    >
      <HaideeInvoicePrintHeader
        nameZh={company.nameZh}
        nameEn={company.nameEn}
        nameTh={
          mode === "1a"
            ? mode1aIssuer?.nameTh
            : undefined
        }
        addressLines={[...details.addressLines]}
        phone={details.phone}
        taxId={`Registration No.: ${details.registrationNo}`}
        subtitle={`${data.customerName} · ${data.periodLabel} · ${data.currency}`}
      />

      <HaideeInvoiceMetaBlocks
        billToLabel={data.billToRole === "consignee" ? "收货人 Consignee" : "寄货人 Shipper"}
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
        const sectionTitle = accountingSectionTitle(section.kind, section.title);
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
                      {getHaideeAccountingInvoiceRouteLabel(mode, row.marketCode)}
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

      <HaideeInvoiceExtraChargesTable charges={extraCharges} />

      <HaideeInvoiceGrandTotal
        amountMyr={summary.grandTotalAmount}
        currency={data.currency}
        labelColSpan={3}
      />

      <div className="mode1a-invoice-amount-words">{amountInWords}</div>

      <div className="mode1a-invoice-bank">
        <strong>Bank Account:</strong> {bankAccountLine}
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
