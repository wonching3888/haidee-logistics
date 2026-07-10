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
  it("orders by confirm time: receipt then payment → never goes negative", () => {
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
          // Confirmed later — must appear after receipt despite PV < RV alphabetically
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

  it("orders by confirm time: payment then receipt → intermediate balance is negative", () => {
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

  it("sorts by confirm timestamp, not business date or voucher number", () => {
    const rows = buildCashBookLedgerRows({
      book: "THB",
      openingBalance: 0,
      sourceRows: [
        {
          kind: "payment",
          id: "p2",
          voucherNo: "PV-20260709-001",
          voucherDate: "2026-07-09",
          description: "confirmed later",
          amount: 50,
          sortKey: "2026-07-11T12:00:00.000Z",
        },
        {
          kind: "receipt",
          id: "r1",
          voucherNo: "RV-20260711-001",
          voucherDate: "2026-07-11",
          description: "confirmed earlier",
          amount: 100,
          sortKey: "2026-07-10T08:00:00.000Z",
        },
      ],
    });
    expect(rows[1]!.voucherNo).toBe("RV-20260711-001");
    expect(rows[2]!.voucherNo).toBe("PV-20260709-001");
    expect(rows[2]!.balance).toBe(50);
  });
});
