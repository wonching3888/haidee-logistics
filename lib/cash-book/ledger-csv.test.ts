import { describe, expect, it } from "vitest";
import {
  buildCashBookLedgerRows,
  sliceCashBookLedgerStatement,
} from "@/lib/cash-book/ledger";
import { buildCashBookLedgerCsv } from "@/lib/cash-book/ledger-csv";

describe("buildCashBookLedgerCsv", () => {
  const rows = buildCashBookLedgerRows({
    book: "THB",
    openingBalance: 100,
    sourceRows: [
      {
        kind: "receipt",
        id: "r1",
        voucherNo: "RV-20260701-001",
        voucherDate: "2026-07-01",
        description: "备用金, 总部",
        amount: 500,
        sortKey: "2026-07-01T10:00:00.000Z",
      },
      {
        kind: "payment",
        id: "p1",
        voucherNo: "PV-20260702-001",
        voucherDate: "2026-07-02",
        description: "运费",
        amount: 120.5,
        sortKey: "2026-07-02T10:00:00.000Z",
      },
    ],
  });

  const statement = sliceCashBookLedgerStatement(rows, {
    from: "2026-07-01",
    to: "2026-07-31",
  });

  it("starts with UTF-8 BOM and correct headers", () => {
    const csv = buildCashBookLedgerCsv("THB", statement);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const firstLine = csv.slice(1).split("\r\n")[0];
    expect(firstLine).toBe(
      "日期,编号,说明,DEBIT 收入,CREDIT 支出,BALANCE 余额"
    );
  });

  it("escapes commas in description and writes opening/total amounts", () => {
    const csv = buildCashBookLedgerCsv("THB", statement);
    const lines = csv.slice(1).split("\r\n").filter(Boolean);
    expect(lines[1]).toBe(
      "2026-07-01,,期初余额 Opening balance (THB),,,100.00"
    );
    expect(lines[2]).toContain('"备用金, 总部"');
    expect(lines[2]).toContain("500.00");
    expect(lines[lines.length - 1]).toBe(
      ",,合计 Total,120.50,500.00,479.50"
    );
  });
});
