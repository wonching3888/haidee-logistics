import type { MonthlyInvoiceModeConfig } from "@/lib/constants/monthly-invoice";
import { INVOICE_COMPANY_HEADERS } from "@/lib/constants/monthly-invoice";
import type {
  InvoiceListingByShipperData,
  InvoiceListingData,
  InvoiceListingSection,
} from "@/lib/monthly-invoice-aggregate";
import { formatQty, formatQtyOrBlank } from "@/lib/number-format";
import {
  PrintLetterhead,
  WtlExpressInvoiceLetterhead,
} from "@/components/shared/PrintLogo";

export interface InvoiceListingPrintProps {
  issuerKey: MonthlyInvoiceModeConfig["issuerKey"];
  customerName: string;
  periodLabel: string;
  listing: InvoiceListingData;
  /** Mode 2: group listing matrices by inbound shipper. */
  listingByShipper?: InvoiceListingByShipperData;
}

function ListingSectionTable({ section }: { section: InvoiceListingSection }) {
  return (
    <div className="monthly-invoice-section">
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
                  {formatQtyOrBlank(row.values[column.marketCode])}
                </td>
              ))}
              <td className="text-right">{formatQty(row.rowTotal)}</td>
            </tr>
          ))}
          <tr className="monthly-invoice-section-total">
            <td className="mode4-listing-subtotal-cell">
              <span className="mode4-listing-entry-count">
                共 {formatQty(section.rows.length)} 笔 · {formatQty(section.rows.length)} entries
              </span>
              <span className="mode4-listing-subtotal-label">小计 Subtotal</span>
            </td>
            {section.columns.map((column) => (
              <td key={column.marketCode} className="text-right">
                {formatQtyOrBlank(section.columnTotals[column.marketCode])}
              </td>
            ))}
            <td className="text-right">{formatQty(section.grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function InvoiceListingPrint({
  issuerKey,
  customerName,
  periodLabel,
  listing,
  listingByShipper,
}: InvoiceListingPrintProps) {
  const company = INVOICE_COMPANY_HEADERS[issuerKey];

  return (
    <div className="document-print mode4-listing-print">
      {issuerKey === "wtl" ? (
        <WtlExpressInvoiceLetterhead />
      ) : (
        <PrintLetterhead nameZh={company.nameZh} nameEn={company.nameEn} />
      )}

      <div className="mode4-listing-title">Listing</div>
      <div className="header-sub">
        {customerName} · {periodLabel}
      </div>

      {listingByShipper ? (
        <>
          {listingByShipper.shipperGroups.map((group) => (
            <div key={group.shipperId} className="mode4-listing-shipper-group">
              <div className="mode4-listing-shipper-title">
                寄货人 Shipper: {group.shipperName} ({group.shipperCode})
              </div>
              {group.listing.sections.map((section) => (
                <ListingSectionTable
                  key={`${group.shipperId}-${section.kind}`}
                  section={section}
                />
              ))}
              <table className="monthly-invoice-table mode4-listing-table mode4-listing-shipper-total">
                <tbody>
                  <tr className="monthly-invoice-section-total">
                    <td className="text-right" colSpan={99}>
                      寄货人小计 Shipper Subtotal · {formatQty(group.groupTotalQty)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
          <table className="monthly-invoice-table mode4-listing-table mode4-listing-overall-total">
            <tbody>
              <tr className="monthly-invoice-grand-row">
                <td className="text-right" colSpan={99}>
                  总计 Grand Total · {formatQty(listingByShipper.overallTotalQty)}
                </td>
              </tr>
            </tbody>
          </table>
        </>
      ) : (
        listing.sections.map((section) => (
          <ListingSectionTable key={section.kind} section={section} />
        ))
      )}
    </div>
  );
}
