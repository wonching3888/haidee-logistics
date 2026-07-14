import { describe, expect, it } from "vitest";
import {
  buildCashBookPvAutocountCsv,
  filterCashBookPvLinesForAutocountExport,
  isAdvanceOnlyCashBookPvLines,
} from "@/lib/cash-book/payment-voucher-autocount-export";

describe("filterCashBookPvLinesForAutocountExport", () => {
  it("keeps only 6301–6306 and drops 3500", () => {
    const filtered = filterCashBookPvLinesForAutocountExport([
      { accountCode: "3500-0000", amount: 280 },
      { accountCode: "6301-0000", amount: 10 },
      { accountCode: "9004-0000", amount: 50 },
      { accountCode: "6306-0000", amount: 8 },
    ]);
    expect(filtered.map((l) => l.accountCode)).toEqual([
      "6301-0000",
      "6306-0000",
    ]);
  });

  it("drops an entire advance-only voucher (no exportable lines)", () => {
    const filtered = filterCashBookPvLinesForAutocountExport([
      { accountCode: "3500-0000", amount: 200 },
    ]);
    expect(filtered).toEqual([]);
    expect(
      isAdvanceOnlyCashBookPvLines([{ accountCode: "3500-0000" }])
    ).toBe(true);
  });
});

describe("buildCashBookPvAutocountCsv", () => {
  it("emits BOM header and line rows", () => {
    const csv = buildCashBookPvAutocountCsv([
      {
        docNo: "PV-20260714-001",
        docDate: "2026-07-14",
        paidTo: "Halim",
        accNo: "6301-0000",
        accountName: "CHOP BORDER PASS",
        description: "Halim / KFW 3888 / 2026-07-14",
        amount: 10,
        paymentMethod: "CASH",
      },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("6301-0000");
    expect(csv).not.toContain("3500-0000");
  });
});
