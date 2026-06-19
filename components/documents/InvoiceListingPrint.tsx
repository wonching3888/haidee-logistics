import type { MonthlyInvoiceModeConfig } from "@/lib/constants/monthly-invoice";
import { INVOICE_COMPANY_HEADERS } from "@/lib/constants/monthly-invoice";
import type { InvoiceListingData } from "@/lib/monthly-invoice-aggregate";
import { PrintLetterhead } from "@/components/shared/PrintLogo";

export interface InvoiceListingPrintProps {
  issuerKey: MonthlyInvoiceModeConfig["issuerKey"];
  customerName: string;
  periodLabel: string;
  listing: InvoiceListingData;
}

export function InvoiceListingPrint({
  issuerKey,
  customerName,
  periodLabel,
  listing,
}: InvoiceListingPrintProps) {
  const company = INVOICE_COMPANY_HEADERS[issuerKey];

  return (
    <div className="document-print mode4-listing-print">
      <PrintLetterhead nameZh={company.nameZh} nameEn={company.nameEn} />

      <div className="mode4-listing-title">Listing</div>
      <div className="header-sub">
        {customerName} · {periodLabel}
      </div>

      {listing.sections.map((section) => (
        <div key={section.kind} className="monthly-invoice-section">
          <div className="monthly-invoice-section-title">{section.title}</div>
          <table className="monthly-invoice-table mode4-listing-table">
            <thead>
              <tr>
                <th className="mode4-listing-date-col">日期 Date</th>
                {section.columns.map((column) => (
                  <th key={column.marketCode} className="mode4-listing-market-col">
                    {column.header}
                  </th>
                ))}
                <th className="mode4-listing-total-col">合计 Total</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => (
                <tr key={`${section.kind}-${row.dateKey}`}>
                  <td>{row.dateLabel}</td>
                  {section.columns.map((column) => (
                    <td key={column.marketCode} className="text-right">
                      {row.values[column.marketCode] || ""}
                    </td>
                  ))}
                  <td className="text-right">{row.rowTotal}</td>
                </tr>
              ))}
              <tr className="monthly-invoice-section-total">
                <td className="text-right">小计 Subtotal</td>
                {section.columns.map((column) => (
                  <td key={column.marketCode} className="text-right">
                    {section.columnTotals[column.marketCode] || ""}
                  </td>
                ))}
                <td className="text-right">{section.grandTotal}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
