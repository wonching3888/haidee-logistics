import type { CashBookLedgerStatement } from "@/lib/cash-book/ledger";
import type { CashBookLedger } from "@/lib/constants/cash-book-accounts";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function money(n: number | null): string {
  return n == null ? "" : n.toFixed(2);
}

export function buildCashBookLedgerCsv(
  book: CashBookLedger,
  statement: CashBookLedgerStatement
): string {
  const header = [
    "日期",
    "编号",
    "说明",
    "DEBIT 收入",
    "CREDIT 支出",
    "BALANCE 余额",
  ]
    .map(csvEscape)
    .join(",");
  const openingRow = [
    statement.range.from,
    "",
    `期初余额 Opening balance (${book})`,
    "",
    "",
    money(statement.openingBalance),
  ]
    .map(csvEscape)
    .join(",");

  const body = statement.rows.map((row) =>
    [
      row.date,
      row.voucherNo ?? "",
      row.description,
      money(row.debit),
      money(row.credit),
      money(row.balance),
    ]
      .map(csvEscape)
      .join(",")
  );

  const totalRow = [
    "",
    "",
    "合计 Total",
    money(statement.totalDebit),
    money(statement.totalCredit),
    money(statement.closingBalance),
  ]
    .map(csvEscape)
    .join(",");

  // \uFEFF BOM 前缀，保证 Excel 打开中文不乱码——跟 buildCashBookPvAutocountCsv 的做法一致
  return `\uFEFF${[header, openingRow, ...body, totalRow].join("\r\n")}\r\n`;
}
