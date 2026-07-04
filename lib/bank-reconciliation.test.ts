import { describe, expect, it } from "vitest";
import {
  buildBankReconciliationCsv,
  defaultBankReconciliationMonthRange,
  flattenBankReconciliationRows,
  type BankReconciliationData,
} from "@/lib/bank-reconciliation-shared";

function sampleData(): BankReconciliationData {
  return {
    dateFrom: "2026-06-01",
    dateTo: "2026-06-30",
    thbGroups: [
      {
        bankAccount: "HAIDEE_BBL5030",
        currency: "THB",
        totalAmount: 100,
        reconciledAmount: 40,
        unreconciledAmount: 60,
        payments: [
          {
            id: "p1",
            paymentDate: "2026-06-05",
            customerKey: "shipper:a",
            customerName: "Alpha",
            amount: 40,
            currency: "THB",
            bankAccount: "HAIDEE_BBL5030",
            invoiceNos: "HD-2606-001",
            isReconciled: true,
            reconciledAt: "2026-06-10T00:00:00.000Z",
            reconciledBy: "u1",
          },
          {
            id: "p2",
            paymentDate: "2026-06-12",
            customerKey: "shipper:b",
            customerName: "Beta, Co",
            amount: 60,
            currency: "THB",
            bankAccount: "HAIDEE_BBL5030",
            invoiceNos: "HD-2606-002, HD-2606-003",
            isReconciled: false,
            reconciledAt: null,
            reconciledBy: null,
          },
        ],
      },
      {
        bankAccount: "CASH",
        currency: "THB",
        totalAmount: 0,
        reconciledAmount: 0,
        unreconciledAmount: 0,
        payments: [],
      },
    ],
    myrGroups: [
      {
        bankAccount: "WTL_PBB1725",
        currency: "MYR",
        totalAmount: 50,
        reconciledAmount: 0,
        unreconciledAmount: 50,
        payments: [
          {
            id: "p3",
            paymentDate: "2026-06-08",
            customerKey: "shipper:c",
            customerName: "Charlie",
            amount: 50,
            currency: "MYR",
            bankAccount: "WTL_PBB1725",
            invoiceNos: "",
            isReconciled: false,
            reconciledAt: null,
            reconciledBy: null,
          },
        ],
      },
    ],
  };
}

describe("bank-reconciliation helpers", () => {
  it("defaultBankReconciliationMonthRange covers full calendar month", () => {
    const range = defaultBankReconciliationMonthRange(
      new Date(2026, 5, 15)
    );
    expect(range).toEqual({ dateFrom: "2026-06-01", dateTo: "2026-06-30" });
  });

  it("flattenBankReconciliationRows preserves THB then MYR order", () => {
    const rows = flattenBankReconciliationRows(sampleData());
    expect(rows.map((r) => r.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("buildBankReconciliationCsv includes BOM, header, and reconciled flags", () => {
    const csv = buildBankReconciliationCsv(sampleData());
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(
      "Currency,Bank Account,Payment Date,Customer,Amount,Invoice Nos,Reconciled,Reconciled At"
    );
    expect(csv).toContain("THB,HAIDEE BBL 5335,2026-06-05,Alpha,40.00,HD-2606-001,Y,");
    expect(csv).toContain('"Beta, Co"');
    expect(csv).toContain("MYR,WTL PBB 1725,2026-06-08,Charlie,50.00,,N,");
  });
});
