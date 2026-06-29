import { beforeEach, describe, expect, it, vi } from "vitest";
import { canExportArInvoice, canExportPayrollJv, canAccessAutocountExport } from "@/lib/auth-roles";
import {
  mapReceivableInvoiceToArFreightSource,
} from "@/lib/ar-invoice-export/ar-invoice-freight-fetcher";
import {
  assignFreightDocNos,
  arFreightCsvFilename,
  buildArFreightExportPreview,
} from "@/lib/ar-invoice-export/ar-invoice-freight-export";
import type { ArInvoiceAmountSource } from "@/lib/ar-invoice-export/ar-invoice-row";
import type { ReceivableInvoice } from "@/lib/receivable-invoices";
import { generateArInvoiceCsv } from "@/lib/ar-invoice-export/ar-invoice-row";

vi.mock("@/lib/ar-invoice-export/ar-invoice-freight-fetcher", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/ar-invoice-export/ar-invoice-freight-fetcher")
  >("@/lib/ar-invoice-export/ar-invoice-freight-fetcher");
  return {
    ...actual,
    fetchFreightAmountsForMonth: vi.fn(),
  };
});

import { fetchFreightAmountsForMonth } from "@/lib/ar-invoice-export/ar-invoice-freight-fetcher";

const mockedFetch = vi.mocked(fetchFreightAmountsForMonth);

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetch.mockReset();
});

function freightInvoice(
  overrides: Partial<ReceivableInvoice> & Pick<ReceivableInvoice, "invoiceKey">
): ReceivableInvoice {
  return {
    invoiceType: "freight",
    invoiceNo: "2-202606-CODE",
    customerKey: "consignee:id-1",
    customerKind: "consignee",
    customerId: "id-1",
    customerCode: "3002-A001",
    customerName: "Alpha",
    yearMonth: "2026-06",
    sortDate: "2026-06-01",
    currency: "MYR",
    issuerKey: "haidee",
    totalAmount: 1234.56,
    sourceMeta: { mode: "2", billToKind: "consignee" },
    printHref: "/documents/monthly-invoice/print",
    ...overrides,
  };
}

function source(
  overrides: Partial<ArInvoiceAmountSource> & Pick<ArInvoiceAmountSource, "debtorCode">
): ArInvoiceAmountSource {
  return {
    revenueKind: "freight",
    mode: "2",
    debtorName: overrides.debtorName ?? overrides.debtorCode,
    year: 2026,
    month: 6,
    amount: 100,
    currency: "MYR",
    ...overrides,
  };
}

describe("mapReceivableInvoiceToArFreightSource", () => {
  it("maps receivable freight invoice totalAmount without transformation", () => {
    const invoice = freightInvoice({ invoiceKey: "freight:2:consignee:id-1:2026-06" });
    const mapped = mapReceivableInvoiceToArFreightSource(invoice, 2026, 6);
    expect(mapped).toMatchObject({
      debtorCode: "3002-A001",
      amount: 1234.56,
      currency: "MYR",
      mode: "2",
    });
  });

  it("maps mode 4 shipper debtor code from receivable row", () => {
    const invoice = freightInvoice({
      invoiceKey: "freight:4:shipper:ship-1:2026-06",
      customerKind: "shipper",
      customerCode: "3001-W001",
      customerName: "WTL Shipper",
      sourceMeta: { mode: "4", billToKind: "shipper" },
    });
    const mapped = mapReceivableInvoiceToArFreightSource(invoice, 2026, 6);
    expect(mapped?.debtorCode).toBe("3001-W001");
    expect(mapped?.mode).toBe("4");
  });
});

describe("assignFreightDocNos shared prefix", () => {
  it("assigns HDR- DocNos sorted by debtor code for mode 2", async () => {
    mockedFetch.mockResolvedValueOnce([
      source({ debtorCode: "3002-C003", amount: 300 }),
      source({ debtorCode: "3002-A001", amount: 100 }),
      source({ debtorCode: "3002-B002", amount: 200 }),
    ]);

    const docNos = await assignFreightDocNos(2026, 6, "2", [
      source({ debtorCode: "3002-C003" }),
      source({ debtorCode: "3002-A001" }),
      source({ debtorCode: "3002-B002" }),
    ]);

    expect(docNos.get("3002-A001")).toBe("HDR-2606-001");
    expect(docNos.get("3002-B002")).toBe("HDR-2606-002");
    expect(docNos.get("3002-C003")).toBe("HDR-2606-003");
  });

  it("reserves EXP- slots for mode 3 before allocating mode 4", async () => {
    mockedFetch
      .mockResolvedValueOnce([
        source({ debtorCode: "3000-B001", mode: "3", amount: 1 }),
        source({ debtorCode: "3000-B002", mode: "3", amount: 2 }),
      ])
      .mockResolvedValueOnce([
        source({ debtorCode: "3001-A001", mode: "4", amount: 3 }),
        source({ debtorCode: "3001-B002", mode: "4", amount: 4 }),
      ]);

    const mode4Sources = [
      source({ debtorCode: "3001-B002", mode: "4" }),
      source({ debtorCode: "3001-A001", mode: "4" }),
    ];
    const docNos = await assignFreightDocNos(2026, 6, "4", mode4Sources);

    expect(docNos.get("3001-A001")).toBe("EXP-2606-003");
    expect(docNos.get("3001-B002")).toBe("EXP-2606-004");
  });

  it("reserves HD- slots for mode 1a before allocating mode 1b", async () => {
    mockedFetch.mockResolvedValueOnce([
      source({ debtorCode: "3001-A001", mode: "1a", currency: "THB", amount: 1 }),
    ]);

    const docNos = await assignFreightDocNos(2026, 6, "1b", [
      source({ debtorCode: "3001-B002", mode: "1b", currency: "THB" }),
    ]);

    expect(docNos.get("3001-B002")).toBe("HD-2606-002");
  });
});

describe("buildArFreightExportPreview", () => {
  it("builds rows with account, tax, currency and CSV output", async () => {
    mockedFetch.mockResolvedValueOnce([
      source({ debtorCode: "3000-B002", mode: "3", amount: 500 }),
    ]);

    const preview = await buildArFreightExportPreview({
      year: 2026,
      month: 6,
      mode: "3",
    });

    expect(preview.rowCount).toBe(1);
    expect(preview.totalAmount).toBe(500);
    expect(preview.docNoFirst).toBe("EXP-2606-001");
    expect(preview.rows[0]).toMatchObject({
      debtorCode: "3000-B002",
      accNo: "5000-B002",
      taxType: "SV-6",
      currency: "MYR",
    });

    const csv = generateArInvoiceCsv(
      preview.rows.map((row) => ({
        docNo: row.docNo,
        docDate: "01/06/2026",
        debtorCode: row.debtorCode,
        debtorName: row.debtorName,
        description: "运费 2026年6月",
        accNo: row.accNo,
        taxType: row.taxType,
        amount: row.amount,
        currencyRate: "",
        refNo2: "",
        detailDescription: "",
        toAccountRate: "",
        currency: row.currency,
        taxableAmt: "",
      }))
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("5000-B002");
    expect(csv).toContain("SV-6");
    expect(csv).toContain("500.00");
  });
});

describe("arFreightCsvFilename", () => {
  it("includes mode and year-month", () => {
    expect(arFreightCsvFilename(2026, 6, "2")).toBe(
      "ar-invoice-freight-2-2026-06.csv"
    );
  });
});

describe("canExportArInvoice", () => {
  it("allows admin and my_accounting only", () => {
    expect(canExportArInvoice("admin")).toBe(true);
    expect(canExportArInvoice("my_accounting")).toBe(true);
    expect(canExportArInvoice("clerk")).toBe(false);
    expect(canExportArInvoice("viewer")).toBe(false);
    expect(canExportArInvoice("admin")).toBe(canExportPayrollJv("admin"));
  });
});

describe("canAccessAutocountExport", () => {
  it("matches AR / JV export permissions", () => {
    expect(canAccessAutocountExport("admin")).toBe(true);
    expect(canAccessAutocountExport("my_accounting")).toBe(true);
    expect(canAccessAutocountExport("clerk")).toBe(false);
    expect(canAccessAutocountExport("admin")).toBe(canExportArInvoice("admin"));
  });
});
