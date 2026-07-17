import { describe, expect, it } from "vitest";
import {
  buildCashBookLedgerRows,
  formatCashBookLedgerDescription,
  sliceCashBookLedgerStatement,
} from "@/lib/cash-book/ledger";
import { normalizeReceiptVoucherInput } from "@/lib/cash-book/receipt-voucher";

describe("formatCashBookLedgerDescription", () => {
  it("dedupes identical paidTo and particulars", () => {
    expect(
      formatCashBookLedgerDescription(
        "OT FISH LOADING 30/06/69 SOO",
        "OT FISH LOADING 30/06/69 SOO"
      )
    ).toBe("OT FISH LOADING 30/06/69 SOO");
  });

  it("keeps both sides when primary and secondary differ", () => {
    expect(
      formatCashBookLedgerDescription(
        "宋卡搬运",
        "2026-07-01 / 宋卡 Songkhla / 搬运费"
      )
    ).toBe("宋卡搬运 — 2026-07-01 / 宋卡 Songkhla / 搬运费");
  });

  it("returns the non-empty side when the other is blank", () => {
    expect(formatCashBookLedgerDescription("", "only particulars")).toBe(
      "only particulars"
    );
    expect(formatCashBookLedgerDescription("only payee", null)).toBe(
      "only payee"
    );
  });

  it("collapses when one side is a trivial substring of the other", () => {
    expect(
      formatCashBookLedgerDescription(
        "OT FISH LOADING",
        "OT FISH LOADING 30/06/69 SOO"
      )
    ).toBe("OT FISH LOADING 30/06/69 SOO");
  });
});

describe("normalizeReceiptVoucherInput", () => {
  it("requires account and positive amount", () => {
    expect(() =>
      normalizeReceiptVoucherInput({
        book: "THB",
        receivedFrom: "HQ float",
        accountCode: "",
        amount: 500,
      })
    ).toThrow(/科目/);
    expect(() =>
      normalizeReceiptVoucherInput({
        book: "THB",
        receivedFrom: "HQ float",
        accountCode: "3202-0000",
        amount: 0,
      })
    ).toThrow(/金额/);
  });

  it("accepts valid THB receipt", () => {
    const row = normalizeReceiptVoucherInput({
      book: "THB",
      receivedFrom: "公司总部备用金",
      accountCode: "3202-0000",
      amount: 500,
      notes: "test",
    });
    expect(row.amount).toBe(500);
    expect(row.accountName).toContain("CASH IN HAND");
  });
});

describe("buildCashBookLedgerRows", () => {
  it("same voucherDate: receipt then payment by confirm time → never goes negative", () => {
    const rows = buildCashBookLedgerRows({
      book: "THB",
      openingBalance: 0,
      sourceRows: [
        {
          kind: "payment",
          id: "p1",
          voucherNo: "PV-20260710-001",
          voucherDate: "2026-07-10",
          description: "付款",
          amount: 200,
          sortKey: "2026-07-10T10:00:02.000Z",
        },
        {
          kind: "receipt",
          id: "r1",
          voucherNo: "RV-20260710-001",
          voucherDate: "2026-07-10",
          description: "备用金",
          amount: 500,
          sortKey: "2026-07-10T10:00:01.000Z",
        },
      ],
    });
    expect(rows).toHaveLength(3);
    expect(rows[0]!.balance).toBe(0);
    expect(rows[1]!.kind).toBe("receipt");
    expect(rows[1]!.credit).toBe(500);
    expect(rows[1]!.balance).toBe(500);
    expect(rows[2]!.kind).toBe("payment");
    expect(rows[2]!.debit).toBe(200);
    expect(rows[2]!.balance).toBe(300);
  });

  it("same voucherDate: payment then receipt by confirm → intermediate balance negative", () => {
    const rows = buildCashBookLedgerRows({
      book: "THB",
      openingBalance: 0,
      sourceRows: [
        {
          kind: "receipt",
          id: "r1",
          voucherNo: "RV-20260710-001",
          voucherDate: "2026-07-10",
          description: "备用金",
          amount: 500,
          sortKey: "2026-07-10T10:00:02.000Z",
        },
        {
          kind: "payment",
          id: "p1",
          voucherNo: "PV-20260710-001",
          voucherDate: "2026-07-10",
          description: "付款",
          amount: 200,
          sortKey: "2026-07-10T10:00:01.000Z",
        },
      ],
    });
    expect(rows[1]!.kind).toBe("payment");
    expect(rows[1]!.balance).toBe(-200);
    expect(rows[2]!.kind).toBe("receipt");
    expect(rows[2]!.balance).toBe(300);
  });

  it("ignores nothing when source empty — opening only", () => {
    const rows = buildCashBookLedgerRows({
      book: "MYR",
      openingBalance: 100,
      sourceRows: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.balance).toBe(100);
  });

  it("sorts by voucherDate first, not confirm timestamp", () => {
    const rows = buildCashBookLedgerRows({
      book: "THB",
      openingBalance: 0,
      sourceRows: [
        {
          kind: "payment",
          id: "p2",
          voucherNo: "PV-20260709-001",
          voucherDate: "2026-07-09",
          description: "confirmed later, earlier business date",
          amount: 50,
          sortKey: "2026-07-11T12:00:00.000Z",
        },
        {
          kind: "receipt",
          id: "r1",
          voucherNo: "RV-20260711-001",
          voucherDate: "2026-07-11",
          description: "confirmed earlier, later business date",
          amount: 100,
          sortKey: "2026-07-10T08:00:00.000Z",
        },
      ],
    });
    expect(rows[1]!.voucherNo).toBe("PV-20260709-001");
    expect(rows[1]!.balance).toBe(-50);
    expect(rows[2]!.voucherNo).toBe("RV-20260711-001");
    expect(rows[2]!.balance).toBe(50);
  });

  it("same date + same confirm: tie-breaks by voucherNo then id", () => {
    const rows = buildCashBookLedgerRows({
      book: "THB",
      openingBalance: 100,
      sourceRows: [
        {
          kind: "payment",
          id: "b",
          voucherNo: "PV-20260710-002",
          voucherDate: "2026-07-10",
          description: "second",
          amount: 10,
          sortKey: "2026-07-10T10:00:00.000Z",
        },
        {
          kind: "payment",
          id: "a",
          voucherNo: "PV-20260710-001",
          voucherDate: "2026-07-10",
          description: "first",
          amount: 20,
          sortKey: "2026-07-10T10:00:00.000Z",
        },
      ],
    });
    expect(rows[1]!.voucherNo).toBe("PV-20260710-001");
    expect(rows[1]!.balance).toBe(80);
    expect(rows[2]!.voucherNo).toBe("PV-20260710-002");
    expect(rows[2]!.balance).toBe(70);
  });
});

describe("sliceCashBookLedgerStatement", () => {
  const fullRows = buildCashBookLedgerRows({
    book: "THB",
    openingBalance: 1000,
    sourceRows: [
      {
        kind: "receipt",
        id: "r1",
        voucherNo: "RV-20260630-001",
        voucherDate: "2026-06-30",
        description: "六月收款",
        amount: 500,
        sortKey: "2026-06-30T10:00:00.000Z",
      },
      {
        kind: "payment",
        id: "p1",
        voucherNo: "PV-20260630-001",
        voucherDate: "2026-06-30",
        description: "六月付款",
        amount: 200,
        sortKey: "2026-06-30T11:00:00.000Z",
      },
      {
        kind: "receipt",
        id: "r2",
        voucherNo: "RV-20260701-001",
        voucherDate: "2026-07-01",
        description: "七月一日收款",
        amount: 100,
        sortKey: "2026-07-01T09:00:00.000Z",
      },
      {
        kind: "payment",
        id: "p2",
        voucherNo: "PV-20260715-001",
        voucherDate: "2026-07-15",
        description: "七月中付款",
        amount: 50,
        sortKey: "2026-07-15T09:00:00.000Z",
      },
      {
        kind: "receipt",
        id: "r3",
        voucherNo: "RV-20270731-001",
        voucherDate: "2026-07-31",
        description: "七月末收款",
        amount: 25,
        sortKey: "2026-07-31T09:00:00.000Z",
      },
    ],
  });

  it("full range matches unsliced opening and closing balances", () => {
    const statement = sliceCashBookLedgerStatement(fullRows, {
      from: "2000-01-01",
      to: "2100-01-01",
    });
    expect(statement.openingBalance).toBe(fullRows[0]!.balance);
    expect(statement.closingBalance).toBe(
      fullRows[fullRows.length - 1]!.balance
    );
    expect(statement.rows).toHaveLength(5);
  });

  it("carries prior transactions into openingBalance and excludes them from rows", () => {
    const statement = sliceCashBookLedgerStatement(fullRows, {
      from: "2026-07-01",
      to: "2026-07-31",
    });
    // After June 30 receipt(+500) and payment(-200): 1000+500-200 = 1300
    expect(statement.openingBalance).toBe(1300);
    expect(statement.rows.map((r) => r.voucherNo)).toEqual([
      "RV-20260701-001",
      "PV-20260715-001",
      "RV-20270731-001",
    ]);
    expect(statement.closingBalance).toBe(1375);
    expect(statement.totalDebit).toBe(50);
    expect(statement.totalCredit).toBe(125);
  });

  it("empty period keeps rows empty and closing === opening with zero totals", () => {
    const statement = sliceCashBookLedgerStatement(fullRows, {
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(statement.rows).toEqual([]);
    expect(statement.openingBalance).toBe(1375);
    expect(statement.closingBalance).toBe(1375);
    expect(statement.totalDebit).toBe(0);
    expect(statement.totalCredit).toBe(0);
  });

  it("includes boundary dates and excludes the day before from", () => {
    const statement = sliceCashBookLedgerStatement(fullRows, {
      from: "2026-07-01",
      to: "2026-07-15",
    });
    expect(statement.rows.map((r) => r.date)).toEqual([
      "2026-07-01",
      "2026-07-15",
    ]);
    expect(statement.rows.some((r) => r.date === "2026-06-30")).toBe(false);
    expect(statement.openingBalance).toBe(1300);
    expect(statement.closingBalance).toBe(1350);
  });
});
