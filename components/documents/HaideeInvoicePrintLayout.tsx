import type { ReactNode } from "react";
import { PrintLetterhead } from "@/components/shared/PrintLogo";
import { formatMoneyAmount, formatMoneyWithCurrency } from "@/lib/number-format";
import { cn } from "@/lib/utils";

export function formatHaideeInvoiceMoney(value: number, currency: string) {
  return formatMoneyWithCurrency(value, currency);
}

interface HaideeInvoicePrintDocumentProps {
  children: ReactNode;
  /** Charter HAIDEE only: full-page border (opt-in). */
  framed?: boolean;
}

/** Shared root wrapper for HAIDEE market + charter invoices. */
export function HaideeInvoicePrintDocument({
  children,
  framed = false,
}: HaideeInvoicePrintDocumentProps) {
  return (
    <div
      className={cn(
        "document-print mode4-tax-invoice-print haidee-market-invoice-print",
        framed && "haidee-charter-invoice-document"
      )}
    >
      {children}
    </div>
  );
}

interface HaideeInvoicePrintHeaderProps {
  nameZh: string;
  nameEn: string;
  subtitle: string;
  nameTh?: string;
  addressLines?: string[];
  phone?: string;
  taxId?: string;
}

export function HaideeInvoicePrintHeader({
  nameZh,
  nameEn,
  subtitle,
  nameTh,
  addressLines,
  phone,
  taxId,
}: HaideeInvoicePrintHeaderProps) {
  return (
    <>
      <PrintLetterhead
        nameZh={nameZh}
        nameEn={nameEn}
        nameTh={nameTh}
        addressLines={addressLines}
        phone={phone}
        taxId={taxId}
      />
      <div className="mode4-tax-invoice-title">INVOICE</div>
      <div className="header-sub">{subtitle}</div>
    </>
  );
}

interface HaideeInvoiceMetaBlocksProps {
  info: ReactNode;
  billToLabel: string;
  billToName: string;
  billToCode?: string | null;
  billToDetail?: ReactNode;
}

export function HaideeInvoiceMetaBlocks({
  info,
  billToLabel,
  billToName,
  billToCode,
  billToDetail,
}: HaideeInvoiceMetaBlocksProps) {
  return (
    <div className="monthly-invoice-meta">
      <div className="monthly-invoice-meta-info">{info}</div>
      <div className="monthly-invoice-bill-to">
        <div className="monthly-invoice-bill-to-label">{billToLabel}</div>
        <div className="monthly-invoice-bill-to-name">{billToName}</div>
        {billToCode ? (
          <div className="monthly-invoice-bill-to-code">{billToCode}</div>
        ) : null}
        {billToDetail}
      </div>
    </div>
  );
}

export interface HaideeInvoiceAmountLine {
  description: string;
  amountMyr: number;
}

interface HaideeInvoiceDescriptionAmountTableProps {
  lines: HaideeInvoiceAmountLine[];
  amountHeader?: string;
  sectionTitle?: string;
}

export function HaideeInvoiceDescriptionAmountTable({
  lines,
  amountHeader = "Amount",
  sectionTitle,
}: HaideeInvoiceDescriptionAmountTableProps) {
  return (
    <div className="monthly-invoice-section">
      {sectionTitle ? (
        <div className="monthly-invoice-section-title">{sectionTitle}</div>
      ) : null}
      <table className="monthly-invoice-table mode4-tax-invoice-table">
        <thead>
          <tr>
            <th className="mode4-route-col">Description</th>
            <th className="mode4-amount-col">{amountHeader}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={`${line.description}-${index}`}>
              <td className="text-left">{line.description}</td>
              <td className="text-right">{formatMoneyAmount(line.amountMyr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface HaideeInvoiceGrandTotalProps {
  amountMyr: number;
  currency: string;
  labelColSpan?: number;
}

export function HaideeInvoiceGrandTotal({
  amountMyr,
  currency,
  labelColSpan = 1,
}: HaideeInvoiceGrandTotalProps) {
  return (
    <table className="monthly-invoice-table mode4-tax-invoice-totals">
      <tbody>
        <tr className="monthly-invoice-grand-row">
          <td className="text-right" colSpan={labelColSpan}>
            总计 Grand Total
          </td>
          <td className="text-right">
            {formatHaideeInvoiceMoney(amountMyr, currency)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function HaideeInvoiceSignatureRow() {
  return (
    <div className="signature-row">
      <span>Prepared by: _______________</span>
      <span>Approved by: _______________</span>
    </div>
  );
}
