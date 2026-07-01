import { describe, expect, it } from "vitest";
import {
  AR_EXPORT_DEBTOR_TAX_TYPES,
  debtorCodeToIncomeAccNo,
  resolveArTaxType,
} from "@/lib/ar-invoice-export/ar-invoice-accounts";
import {
  ArDocNoSequenceAllocator,
  arDocNoPrefixForMode,
  formatArDocNo,
} from "@/lib/ar-invoice-export/ar-invoice-docno";
import {
  AR_INVOICE_CSV_HEADERS,
  buildArInvoiceRow,
  formatArCharterDescription,
  formatArCharterDocDate,
  formatArCrateReturnDescription,
  formatArFreightDescription,
  formatArMonthlyDocDate,
  generateArInvoiceCsv,
} from "@/lib/ar-invoice-export/ar-invoice-row";

describe("debtorCodeToIncomeAccNo", () => {
  it("maps 3001 shipper codes to 5001 income accounts", () => {
    expect(debtorCodeToIncomeAccNo("3001-A009")).toBe("5001-A009");
  });

  it("maps 3002 consignee codes to 5002 income accounts", () => {
    expect(debtorCodeToIncomeAccNo("3002-H002")).toBe("5002-H002");
  });

  it("maps 3000 export codes to 5000 income accounts", () => {
    expect(debtorCodeToIncomeAccNo("3000-B002")).toBe("5000-B002");
  });

  it("trims and uppercases before mapping", () => {
    expect(debtorCodeToIncomeAccNo(" 3001-a009 ")).toBe("5001-A009");
  });

  it("leaves non-3-prefix codes unchanged", () => {
    expect(debtorCodeToIncomeAccNo("LOC-PATTANI")).toBe("LOC-PATTANI");
  });
});

describe("resolveArTaxType", () => {
  it("returns empty string for typical 3001 shippers", () => {
    expect(resolveArTaxType("3001-A009")).toBe("");
  });

  it("returns empty string for typical 3002 consignees", () => {
    expect(resolveArTaxType("3002-H002")).toBe("");
  });

  it("returns SV-6 for the five listed export shippers", () => {
    const sv6Codes = [
      "3000-B001",
      "3000-B002",
      "3000-H003",
      "3000-N001",
      "3000-P001",
    ];
    for (const code of sv6Codes) {
      expect(resolveArTaxType(code)).toBe("SV-6");
      expect(AR_EXPORT_DEBTOR_TAX_TYPES[code]).toBe("SV-6");
    }
  });

  it("returns ESV-6 for TAWAKAR 3000-T002", () => {
    expect(resolveArTaxType("3000-T002")).toBe("ESV-6");
    expect(AR_EXPORT_DEBTOR_TAX_TYPES["3000-T002"]).toBe("ESV-6");
  });

  it("returns empty for unlisted 3000 export codes", () => {
    expect(resolveArTaxType("3000-X999")).toBe("");
  });
});

describe("arDocNoPrefixForMode", () => {
  it("uses HD- for mode 1a and HDR- for mode 1b", () => {
    expect(arDocNoPrefixForMode("1a")).toBe("HD-");
    expect(arDocNoPrefixForMode("1b")).toBe("HDR-");
  });

  it("uses HDR- for mode 2 and charter", () => {
    expect(arDocNoPrefixForMode("2")).toBe("HDR-");
    expect(arDocNoPrefixForMode("charter")).toBe("HDR-");
  });

  it("uses EXP- for mode 3 and mode 4 (shared prefix)", () => {
    expect(arDocNoPrefixForMode("3")).toBe("EXP-");
    expect(arDocNoPrefixForMode("4")).toBe("EXP-");
  });
});

describe("formatArDocNo", () => {
  it("formats prefix + yyMM + three-digit sequence", () => {
    expect(formatArDocNo("HD-", 2026, 6, 1)).toBe("HD-2606-001");
    expect(formatArDocNo("HDR-", 2026, 6, 12)).toBe("HDR-2606-012");
  });
});

describe("ArDocNoSequenceAllocator", () => {
  it("assigns ascending DocNos sorted by debtor code for mode 2", () => {
    const allocator = new ArDocNoSequenceAllocator(2026, 6);
    const prefix = "HDR-";
    const docNos = allocator.allocateForDebtors(prefix, [
      "3002-C003",
      "3002-A001",
      "3002-B002",
    ]);

    expect(docNos.get("3002-A001")).toBe("HDR-2606-001");
    expect(docNos.get("3002-B002")).toBe("HDR-2606-002");
    expect(docNos.get("3002-C003")).toBe("HDR-2606-003");
    expect(allocator.currentSequence(prefix)).toBe(3);
  });

  it("continues HDR- sequence for charter after mode 2 customers", () => {
    const allocator = new ArDocNoSequenceAllocator(2026, 6);
    const prefix = "HDR-";

    allocator.allocateForDebtors(prefix, [
      "3002-C003",
      "3002-A001",
      "3002-B002",
    ]);

    const charterTrip1 = allocator.allocate(prefix);
    const charterTrip2 = allocator.allocate(prefix);

    expect(charterTrip1).toBe("HDR-2606-004");
    expect(charterTrip2).toBe("HDR-2606-005");
    expect(allocator.currentSequence(prefix)).toBe(5);
  });

  it("continues EXP- sequence for mode 4 after mode 3 customers", () => {
    const allocator = new ArDocNoSequenceAllocator(2026, 6);
    const prefix = "EXP-";

    const mode3DocNos = allocator.allocateForDebtors(prefix, [
      "3002-B002",
      "3002-A001",
    ]);
    expect(mode3DocNos.get("3002-A001")).toBe("EXP-2606-001");
    expect(mode3DocNos.get("3002-B002")).toBe("EXP-2606-002");

    const mode4DocNos = allocator.allocateForDebtors(prefix, [
      "3001-B002",
      "3001-A001",
    ]);
    expect(mode4DocNos.get("3001-A001")).toBe("EXP-2606-003");
    expect(mode4DocNos.get("3001-B002")).toBe("EXP-2606-004");
    expect(allocator.currentSequence(prefix)).toBe(4);
  });

  it("keeps separate counters per prefix in the same month", () => {
    const allocator = new ArDocNoSequenceAllocator(2026, 6);
    expect(allocator.allocate("HD-")).toBe("HD-2606-001");
    expect(allocator.allocate("EXP-")).toBe("EXP-2606-001");
    expect(allocator.allocate("HD-")).toBe("HD-2606-002");
  });
});

describe("AR description and DocDate helpers", () => {
  it("formats monthly freight and crate return descriptions", () => {
    expect(formatArFreightDescription(2026, 6)).toBe("运费 2026年6月");
    expect(formatArCrateReturnDescription(2026, 6)).toBe("收桶费 2026年6月");
  });

  it("formats monthly DocDate as 01/MM/YYYY", () => {
    expect(formatArMonthlyDocDate(2026, 6)).toBe("01/06/2026");
  });

  it("formats charter DocDate and description from trip date", () => {
    expect(formatArCharterDocDate("2026-06-15")).toBe("15/06/2026");
    expect(formatArCharterDescription("2026-06-15")).toBe("运费 2026-6-15");
  });
});

describe("buildArInvoiceRow", () => {
  it("assembles monthly freight row with account, tax, description, and date", () => {
    const row = buildArInvoiceRow({
      docNo: "HD-2606-001",
      revenueKind: "freight",
      debtorCode: "3001-A009",
      debtorName: "Customer A",
      amount: 1234.5,
      year: 2026,
      month: 6,
    });

    expect(row).toMatchObject({
      docNo: "HD-2606-001",
      docDate: "01/06/2026",
      debtorCode: "3001-A009",
      debtorName: "Customer A",
      description: "运费 2026年6月",
      accNo: "5001-A009",
      taxType: "",
      amount: 1234.5,
    });
  });

  it("assembles export row with SV-6 tax type", () => {
    const row = buildArInvoiceRow({
      docNo: "EXP-2606-001",
      revenueKind: "freight",
      debtorCode: "3000-B002",
      debtorName: "BEST BROTHER",
      amount: 500,
      year: 2026,
      month: 6,
    });

    expect(row.accNo).toBe("5000-B002");
    expect(row.taxType).toBe("SV-6");
  });

  it("assembles TAWAKAR row with ESV-6", () => {
    const row = buildArInvoiceRow({
      docNo: "EXP-2606-002",
      revenueKind: "crate_return",
      debtorCode: "3000-T002",
      debtorName: "TAWAKAR",
      amount: 88,
      year: 2026,
      month: 6,
    });

    expect(row.accNo).toBe("5000-T002");
    expect(row.taxType).toBe("ESV-6");
    expect(row.description).toBe("收桶费 2026年6月");
  });

  it("assembles charter row with trip date DocDate and description", () => {
    const row = buildArInvoiceRow({
      docNo: "HDR-2606-004",
      revenueKind: "charter",
      debtorCode: "3002-H002",
      debtorName: "Consignee H",
      amount: 1500,
      year: 2026,
      month: 6,
      tripDate: "2026-06-18",
    });

    expect(row.docDate).toBe("18/06/2026");
    expect(row.description).toBe("运费 2026-6-18");
    expect(row.accNo).toBe("5002-H002");
    expect(row.taxType).toBe("");
  });
});

describe("generateArInvoiceCsv", () => {
  it("emits UTF-8 BOM, 14-column headers, and formatted amounts", () => {
    const csv = generateArInvoiceCsv([
      buildArInvoiceRow({
        docNo: "HD-2606-001",
        revenueKind: "freight",
        debtorCode: "3001-A009",
        debtorName: "Customer A",
        amount: 1000,
        year: 2026,
        month: 6,
      }),
      buildArInvoiceRow({
        docNo: "EXP-2606-001",
        revenueKind: "freight",
        debtorCode: "3000-B002",
        debtorName: "BEST BROTHER",
        amount: 250.5,
        year: 2026,
        month: 6,
      }),
    ]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.trimEnd().split("\n");
    expect(lines[0].replace(/^\uFEFF/, "")).toBe(
      AR_INVOICE_CSV_HEADERS.join(",")
    );
    expect(lines[1]).toContain("HD-2606-001");
    expect(lines[1]).toContain("5001-A009");
    expect(lines[1]).toContain("1000.00");
    expect(lines[2]).toContain("5000-B002");
    expect(lines[2]).toContain("SV-6");
    expect(lines[2]).toContain("250.50");
  });

  it("escapes commas in debtor names", () => {
    const csv = generateArInvoiceCsv([
      buildArInvoiceRow({
        docNo: "HD-2606-001",
        revenueKind: "freight",
        debtorCode: "3001-A009",
        debtorName: "Foo, Bar Sdn Bhd",
        amount: 1,
        year: 2026,
        month: 6,
      }),
    ]);

    expect(csv).toContain('"Foo, Bar Sdn Bhd"');
  });
});
