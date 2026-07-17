import type { DebtorStatementPrintData } from "@/app/actions/debtor-statement";
import type { DebtorStatementEntry } from "@/lib/invoice-collections-statement";
import type { ArInvoiceListingCompanyKey } from "@/lib/ar-invoice-listing-print";
import { HAIDEE_MODE1A_INVOICE_DETAILS } from "@/lib/constants/haidee-company-details";
import { INVOICE_COMPANY_HEADERS } from "@/lib/constants/monthly-invoice";
import { paginateRows, ROWS_PER_PAGE } from "@/lib/document-utils";
import { formatDisplay } from "@/lib/date-utils";
import { formatMoneyAmount } from "@/lib/number-format";
import {
  PrintLetterhead,
  WtlExpressInvoiceLetterhead,
} from "@/components/shared/PrintLogo";
import "./document-print.css";

interface DebtorStatementPrintProps {
  data: DebtorStatementPrintData;
}

interface StatementPageSpec {
  entries: DebtorStatementEntry[];
  showOpening: boolean;
  showTotal: boolean;
}

function buildStatementPages(
  entries: DebtorStatementEntry[]
): StatementPageSpec[] {
  const pageGroups = paginateRows(entries, ROWS_PER_PAGE);
  const groups = pageGroups.length > 0 ? pageGroups : [[] as DebtorStatementEntry[]];
  return groups.map((pageEntries, index) => ({
    entries: pageEntries,
    showOpening: index === 0,
    showTotal: index === groups.length - 1,
  }));
}

function moneyCell(value: number | null | undefined) {
  if (value == null) return "";
  return formatMoneyAmount(value);
}

function CompanyHeader({
  companyKey,
}: {
  companyKey: ArInvoiceListingCompanyKey;
}) {
  if (companyKey === "wtl") {
    return (
      <div className="debtor-statement-company">
        <WtlExpressInvoiceLetterhead />
      </div>
    );
  }

  const company = INVOICE_COMPANY_HEADERS.haidee;
  return (
    <div className="debtor-statement-company">
      <PrintLetterhead
        nameZh={company.nameZh}
        nameEn={company.nameEn}
        taxId={`Registration No.: ${HAIDEE_MODE1A_INVOICE_DETAILS.registrationNo}`}
        className="debtor-statement-letterhead"
      />
    </div>
  );
}

export function DebtorStatementPrint({ data }: DebtorStatementPrintProps) {
  const pages = buildStatementPages(data.statement.entries);
  const pageCount = pages.length;
  const openingDate = formatDisplay(data.statement.range.from);
  const customerLine = [
    data.customerName,
    data.customerCode ? `(${data.customerCode})` : null,
    data.currency,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {pages.map((page, index) => (
        <div key={`debtor-page-${index}`} className="invoice-print-page">
          <div className="document-print debtor-statement-print">
            <div className="debtor-statement-top">
              <CompanyHeader companyKey={data.issuerKey} />
              <div className="debtor-statement-meta">
                <div>Date: {data.generatedAtLabel}</div>
                <div>User ID: {data.userIdLabel}</div>
              </div>
            </div>

            <div className="debtor-statement-title">
              客户对账单 Statement of Account
            </div>
            <div className="debtor-statement-subtitle">
              {customerLine}
              <br />
              {data.periodLabel}
            </div>

            {page.showOpening ? (
              <div className="debtor-statement-aging">
                <div className="debtor-statement-aging-note">
                  账龄以开票日计 Aging by invoice date · 截至 as of{" "}
                  {formatDisplay(data.asOfDate)}
                </div>
                <table className="debtor-statement-aging-table">
                  <thead>
                    <tr>
                      {data.aging.buckets.map((bucket) => (
                        <th key={bucket.key}>{bucket.label}</th>
                      ))}
                      <th>合计 Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {data.aging.buckets.map((bucket) => (
                        <td key={bucket.key} className="text-right">
                          {formatMoneyAmount(bucket.amount)}
                        </td>
                      ))}
                      <td className="text-right">
                        {formatMoneyAmount(data.aging.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}

            <table className="debtor-statement-table">
              <thead>
                <tr>
                  <th className="debtor-statement-date-col">日期 Date</th>
                  <th className="debtor-statement-no-col">单号 Doc No</th>
                  <th className="debtor-statement-desc-col">
                    说明 Description
                  </th>
                  <th className="debtor-statement-amount-col">
                    欠款 Charge
                  </th>
                  <th className="debtor-statement-amount-col">
                    收款 Credit
                  </th>
                  <th className="debtor-statement-amount-col">
                    余额 Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.showOpening ? (
                  <tr className="debtor-statement-opening-row">
                    <td>{openingDate}</td>
                    <td />
                    <td>期初余额 Opening balance</td>
                    <td />
                    <td />
                    <td className="text-right">
                      {formatMoneyAmount(data.statement.openingBalance)}
                    </td>
                  </tr>
                ) : null}

                {page.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.date ? formatDisplay(entry.date) : ""}</td>
                    <td className="font-mono">{entry.docNo ?? ""}</td>
                    <td>{entry.description}</td>
                    <td className="text-right">{moneyCell(entry.charge)}</td>
                    <td className="text-right">{moneyCell(entry.credit)}</td>
                    <td className="text-right">
                      {formatMoneyAmount(entry.balance)}
                    </td>
                  </tr>
                ))}

                {page.showTotal ? (
                  <tr className="debtor-statement-total-row">
                    <td colSpan={3} className="text-right">
                      合计 Total / 期末余额 Closing
                    </td>
                    <td className="text-right">
                      {formatMoneyAmount(data.statement.totalCharge)}
                    </td>
                    <td className="text-right">
                      {formatMoneyAmount(data.statement.totalCredit)}
                    </td>
                    <td className="text-right">
                      {formatMoneyAmount(data.statement.closingBalance)}
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
