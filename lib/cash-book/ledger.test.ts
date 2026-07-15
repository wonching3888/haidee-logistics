import { describe, expect, it } from "vitest";
import { buildCashBookLedgerRows } from "@/lib/cash-book/ledger";
import { normalizeReceiptVoucherInput } from "@/lib/cash-book/receipt-voucher";

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
