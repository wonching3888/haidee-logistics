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

vi.mock("@/lib/ar-invoice-export/ar-invoice-docno-registry", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/ar-invoice-export/ar-invoice-docno-registry")
  >("@/lib/ar-invoice-export/ar-invoice-docno-registry");
  return {
    ...actual,
    assignDocNosForSources: vi.fn(),
  };
});

import { fetchFreightAmountsForMonth } from "@/lib/ar-invoice-export/ar-invoice-freight-fetcher";
import { assignDocNosForSources } from "@/lib/ar-invoice-export/ar-invoice-docno-registry";

const mockedFetch = vi.mocked(fetchFreightAmountsForMonth);
const mockedAssign = vi.mocked(assignDocNosForSources);

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetch.mockReset();
  mockedAssign.mockReset();
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
  const mode = overrides.mode ?? "2";
  const debtorCode = overrides.debtorCode;
  return {
    revenueKind: "freight",
    entityKey:
      overrides.entityKey ??
      `freight:${mode}:consignee:${debtorCode}:2026-06`,
    mode,
    debtorName: overrides.debtorName ?? debtorCode,
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
      entityKey: "freight:2:consignee:id-1:2026-06",
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

describe("assignFreightDocNos via global registry", () => {
  it("returns DocNos keyed by debtor code from registry", async () => {
    const sources = [
      source({ debtorCode: "3002-C003", entityKey: "freight:2:c3:2026-06" }),
      source({ debtorCode: "3002-A001", entityKey: "freight:2:a1:2026-06" }),
      source({ debtorCode: "3002-B002", entityKey: "freight:2:b2:2026-06" }),
    ];
    mockedAssign.mockResolvedValueOnce(
      new Map([
        ["freight:2:a1:2026-06", "HDR-2606-001"],
        ["freight:2:b2:2026-06", "HDR-2606-002"],
        ["freight:2:c3:2026-06", "HDR-2606-003"],
      ])
    );

    const docNos = await assignFreightDocNos(2026, 6, "2", sources);

    expect(docNos.get("3002-A001")).toBe("HDR-2606-001");
    expect(docNos.get("3002-B002")).toBe("HDR-2606-002");
    expect(docNos.get("3002-C003")).toBe("HDR-2606-003");
  });
});

describe("buildArFreightExportPreview", () => {
  it("builds rows with account, tax, currency and CSV output", async () => {
    const rowSource = source({
      debtorCode: "3000-B002",
      mode: "3",
      entityKey: "freight:3:b2:2026-06",
      amount: 500,
    });
    mockedFetch.mockResolvedValueOnce([rowSource]);
    mockedAssign.mockResolvedValueOnce(
      new Map([["freight:3:b2:2026-06", "EXP-2606-001"]])
    );

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
