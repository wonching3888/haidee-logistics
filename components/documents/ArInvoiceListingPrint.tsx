import type { ArInvoiceRow } from "@/lib/ar-invoice-export/ar-invoice-row";
import type {
  ArInvoiceListingCompanyKey,
  ArInvoiceListingPrintData,
  ArInvoiceListingSection,
} from "@/lib/ar-invoice-listing-print";
import { HAIDEE_MODE1A_INVOICE_DETAILS } from "@/lib/constants/haidee-company-details";
import { INVOICE_COMPANY_HEADERS } from "@/lib/constants/monthly-invoice";
import { paginateRows, ROWS_PER_PAGE } from "@/lib/document-utils";
import { formatMoneyAmount } from "@/lib/number-format";
import {
  PrintLetterhead,
  WtlExpressInvoiceLetterhead,
} from "@/components/shared/PrintLogo";
import "./document-print.css";

interface ArInvoiceListingPrintProps {
  data: ArInvoiceListingPrintData;
}

interface ListingPageSpec {
  section: ArInvoiceListingSection;
  rows: ArInvoiceRow[];
  showSectionTotal: boolean;
  showGrandTotal: boolean;
}

function buildListingPages(
  sections: ArInvoiceListingSection[]
): ListingPageSpec[] {
  const multiSection = sections.length > 1;
  const pages: ListingPageSpec[] = [];

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex]!;
    const sectionPages = paginateRows(section.rows, ROWS_PER_PAGE);
    const pageGroups =
      sectionPages.length > 0 ? sectionPages : [[] as ArInvoiceRow[]];

    for (let pageIndex = 0; pageIndex < pageGroups.length; pageIndex++) {
      const isLastPageInSection = pageIndex === pageGroups.length - 1;
      pages.push({
        section,
        rows: pageGroups[pageIndex]!,
        showSectionTotal: multiSection && isLastPageInSection,
        showGrandTotal:
          sectionIndex === sections.length - 1 && isLastPageInSection,
      });
    }
  }

  if (pages.length === 0) {
    pages.push({
      section: {
        companyKey: "haidee",
        rows: [],
        totalAmount: 0,
      },
      rows: [],
      showSectionTotal: false,
      showGrandTotal: true,
    });
  }

  return pages;
}

function resolveKindLabel(kind: ArInvoiceListingPrintData["kind"]) {
  switch (kind) {
    case "freight":
      return "车力 Freight";
    case "crate_return":
      return "回桶 Crate Return";
    case "charter":
      return "包车 Charter";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function CompanyHeader({ companyKey }: { companyKey: ArInvoiceListingCompanyKey }) {
  if (companyKey === "wtl") {
    return (
      <div className="ar-invoice-listing-company">
        <WtlExpressInvoiceLetterhead />
      </div>
    );
  }

  const company = INVOICE_COMPANY_HEADERS.haidee;
  return (
    <div className="ar-invoice-listing-company">
      <PrintLetterhead
        nameZh={company.nameZh}
        nameEn={company.nameEn}
        taxId={`Registration No.: ${HAIDEE_MODE1A_INVOICE_DETAILS.registrationNo}`}
        className="ar-invoice-listing-letterhead"
      />
    </div>
  );
}

export function ArInvoiceListingPrint({ data }: ArInvoiceListingPrintProps) {
  const pages = buildListingPages(data.sections);
  const pageCount = pages.length;
  const kindLabel = resolveKindLabel(data.kind);
  const modeLabel = data.mode ? ` · Mode ${data.mode}` : "";

  return (
    <>
      {pages.map((page, index) => (
        <div key={`${page.section.companyKey}-${index}`} className="invoice-print-page">
          <div className="document-print ar-invoice-listing-print">
            <div className="ar-invoice-listing-top">
              <CompanyHeader companyKey={page.section.companyKey} />
              <div className="ar-invoice-listing-meta">
                <div>Date: {data.generatedAtLabel}</div>
                <div>User ID: {data.userIdLabel}</div>
              </div>
            </div>

            <div className="ar-invoice-listing-title">Invoice Listing</div>
            <div className="ar-invoice-listing-subtitle">
              {kindLabel}
              {modeLabel} · {data.periodLabel} · {data.currency}
            </div>

            <table className="ar-invoice-listing-table">
              <thead>
                <tr>
                  <th className="ar-invoice-listing-docno-col">Doc No</th>
                  <th className="ar-invoice-listing-date-col">Date</th>
                  <th className="ar-invoice-listing-code-col">Code</th>
                  <th className="ar-invoice-listing-name-col">Debtor Name</th>
                  <th className="ar-invoice-listing-curr-col">Curr.</th>
                  <th className="ar-invoice-listing-total-col">Total</th>
                  <th className="ar-invoice-listing-local-col">Local Total</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <tr key={row.docNo}>
                    <td className="font-mono">{row.docNo}</td>
                    <td>{row.docDate}</td>
                    <td className="font-mono">{row.debtorCode}</td>
                    <td>{row.debtorName}</td>
                    <td>{row.currency}</td>
                    <td className="text-right">{formatMoneyAmount(row.amount)}</td>
                    <td className="text-right">{formatMoneyAmount(row.amount)}</td>
                  </tr>
                ))}

                {page.showSectionTotal ? (
                  <tr className="ar-invoice-listing-total-row">
                    <td className="text-right" colSpan={5}>
                      Subtotal
                    </td>
                    <td className="text-right">
                      {formatMoneyAmount(page.section.totalAmount)}
                    </td>
                    <td className="text-right">
                      {formatMoneyAmount(page.section.totalAmount)}
                    </td>
                  </tr>
                ) : null}

                {page.showGrandTotal ? (
                  <tr className="ar-invoice-listing-total-row">
                    <td className="text-right" colSpan={5}>
                      Total
                    </td>
                    <td className="text-right">
                      {formatMoneyAmount(data.totalAmount)}
                    </td>
                    <td className="text-right">
                      {formatMoneyAmount(data.totalAmount)}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="invoice-page-footer invoice-page-footer-standalone">
            Page {index + 1} of {pageCount}
          </div>
        </div>
      ))}
    </>
  );
}
