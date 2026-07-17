import type { CashBookLedgerStatementPrintData } from "@/app/actions/cash-book-ledger-statement";
import type { CashBookLedgerDisplayRow } from "@/lib/cash-book/ledger";
import { paginateRows, ROWS_PER_PAGE } from "@/lib/document-utils";
import { formatDisplay } from "@/lib/date-utils";
import { formatMoneyAmount } from "@/lib/number-format";
import { PrintLetterhead } from "@/components/shared/PrintLogo";
import "@/components/documents/document-print.css";

interface CashBookLedgerStatementPrintProps {
  data: CashBookLedgerStatementPrintData;
}

interface StatementPageSpec {
  rows: CashBookLedgerDisplayRow[];
  showOpening: boolean;
  showTotal: boolean;
}

function buildStatementPages(
  rows: CashBookLedgerDisplayRow[]
): StatementPageSpec[] {
  const pageGroups = paginateRows(rows, ROWS_PER_PAGE);
  return pageGroups.map((pageRows, index) => ({
    rows: pageRows,
    showOpening: index === 0,
    showTotal: index === pageGroups.length - 1,
  }));
}

function moneyCell(value: number | null | undefined) {
  if (value == null) return "";
  return formatMoneyAmount(value);
}

export function CashBookLedgerStatementPrint({
  data,
}: CashBookLedgerStatementPrintProps) {
  const pages = buildStatementPages(data.rows);
  const pageCount = pages.length;
  const openingDate = formatDisplay(
    `${data.year}-${String(data.month).padStart(2, "0")}-01`
  );

  return (
    <>
      {pages.map((page, index) => (
        <div key={`ledger-page-${index}`} className="invoice-print-page">
          <div className="document-print cash-book-ledger-statement-print">
            <div className="cash-book-ledger-statement-top">
              <div className="cash-book-ledger-statement-company">
                <PrintLetterhead
                  nameZh="海利物流有限公司"
                  nameEn="HAI DEE LOGISTICS CO., LTD."
                  className="cash-book-ledger-statement-letterhead"
                />
              </div>
              <div className="cash-book-ledger-statement-meta">
                <div>Date: {data.generatedAtLabel}</div>
                <div>User ID: {data.userIdLabel}</div>
              </div>
            </div>

            <div className="cash-book-ledger-statement-title">
              {data.book} 账本明细 Cash Book Ledger
            </div>
            <div className="cash-book-ledger-statement-subtitle">
              {data.periodLabel}
            </div>

            <table className="cash-book-ledger-statement-table">
              <thead>
                <tr>
                  <th className="cash-book-ledger-statement-date-col">
                    日期 Date
                  </th>
                  <th className="cash-book-ledger-statement-no-col">
                    编号 No.
                  </th>
                  <th className="cash-book-ledger-statement-desc-col">
                    说明 Description
                  </th>
                  <th className="cash-book-ledger-statement-amount-col">
                    DEBIT 收入
                  </th>
                  <th className="cash-book-ledger-statement-amount-col">
                    CREDIT 支出
                  </th>
                  <th className="cash-book-ledger-statement-amount-col">
                    BALANCE 余额
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.showOpening ? (
                  <tr className="cash-book-ledger-statement-opening-row">
                    <td>{openingDate}</td>
                    <td />
                    <td>期初余额 Opening balance</td>
                    <td />
                    <td />
                    <td className="text-right">
                      {formatMoneyAmount(data.openingBalance)}
                    </td>
                  </tr>
                ) : null}

                {page.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.date ? formatDisplay(row.date) : ""}</td>
                    <td className="font-mono">{row.voucherNo ?? ""}</td>
                    <td>{row.description}</td>
                    <td className="text-right">{moneyCell(row.debit)}</td>
                    <td className="text-right">{moneyCell(row.credit)}</td>
                    <td className="text-right">
                      {formatMoneyAmount(row.balance)}
                    </td>
                  </tr>
                ))}

                {page.showTotal ? (
                  <tr className="cash-book-ledger-statement-total-row">
                    <td colSpan={3} className="text-right">
                      合计 Total / 期末余额 Closing
                    </td>
                    <td className="text-right">
                      {formatMoneyAmount(data.totalDebit)}
                    </td>
                    <td className="text-right">
                      {formatMoneyAmount(data.totalCredit)}
                    </td>
                    <td className="text-right">
                      {formatMoneyAmount(data.closingBalance)}
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
