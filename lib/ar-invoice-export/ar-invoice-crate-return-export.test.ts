import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mapReceivableInvoiceToArCrateReturnSource,
} from "@/lib/ar-invoice-export/ar-invoice-crate-return-fetcher";
import {
  arCrateReturnCsvFilename,
  buildArCrateReturnExportPreview,
} from "@/lib/ar-invoice-export/ar-invoice-crate-return-export";
import type { ReceivableInvoice } from "@/lib/receivable-invoices";

vi.mock("@/lib/ar-invoice-export/ar-invoice-crate-return-fetcher", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/ar-invoice-export/ar-invoice-crate-return-fetcher")
  >("@/lib/ar-invoice-export/ar-invoice-crate-return-fetcher");
  return {
    ...actual,
    fetchCrateReturnAmountsForMonthWithSkips: vi.fn(),
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

import { fetchCrateReturnAmountsForMonthWithSkips } from "@/lib/ar-invoice-export/ar-invoice-crate-return-fetcher";
import { assignDocNosForSources } from "@/lib/ar-invoice-export/ar-invoice-docno-registry";

const mockedFetch = vi.mocked(fetchCrateReturnAmountsForMonthWithSkips);
const mockedAssign = vi.mocked(assignDocNosForSources);

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetch.mockReset();
  mockedAssign.mockReset();
});

function crateInvoice(
  overrides: Partial<ReceivableInvoice> & Pick<ReceivableInvoice, "invoiceKey">
): ReceivableInvoice {
  return {
    invoiceType: "crate_return",
    invoiceNo: "CR-2026-06",
    customerKey: "shipper:id-1",
    customerKind: "shipper",
    customerId: "id-1",
    customerCode: "3002-E001",
    customerName: "Epic Glory",
    yearMonth: "2026-06",
    sortDate: "2026-06-01",
    currency: "MYR",
    issuerKey: "haidee",
    totalAmount: 1200,
    sourceMeta: { crateType: "empty", billToKind: "shipper" },
    printHref: "/documents/crate-return-invoice/print",
    ...overrides,
  };
}

describe("mapReceivableInvoiceToArCrateReturnSource", () => {
  it("maps Epic Glory with receivable grandTotal", () => {
    const invoice = crateInvoice({ invoiceKey: "crate_return:epic-1" });
    const mapped = mapReceivableInvoiceToArCrateReturnSource(invoice, 2026, 6);
    expect(mapped).toMatchObject({
      entityKey: "crate_return:epic-1",
      debtorCode: "3002-E001",
      amount: 1200,
      revenueKind: "crate_return",
    });
  });

  it("skips unknown debtor prefix", () => {
    const invoice = crateInvoice({
      invoiceKey: "crate_return:unknown",
      customerCode: "3999-X",
    });
    expect(mapReceivableInvoiceToArCrateReturnSource(invoice, 2026, 6)).toBeNull();
  });

  it("maps Tawakar 3000-T002", () => {
    const invoice = crateInvoice({
      invoiceKey: "crate_return:tawakar",
      customerCode: "3000-T002",
      customerName: "TAWAKAR",
      totalAmount: 88,
    });
    const mapped = mapReceivableInvoiceToArCrateReturnSource(invoice, 2026, 6);
    expect(mapped?.debtorCode).toBe("3000-T002");
    expect(mapped?.amount).toBe(88);
  });
});

describe("buildArCrateReturnExportPreview", () => {
  it("builds Epic HDR- and Tawakar EXP- rows with 收桶费 description", async () => {
    const sources = [
      {
        revenueKind: "crate_return" as const,
        entityKey: "crate_return:epic",
        debtorCode: "3002-E001",
        debtorName: "Epic Glory",
        year: 2026,
        month: 6,
        amount: 1200,
        currency: "MYR" as const,
      },
      {
        revenueKind: "crate_return" as const,
        entityKey: "crate_return:tawakar",
        debtorCode: "3000-T002",
        debtorName: "TAWAKAR",
        year: 2026,
        month: 6,
        amount: 88,
        currency: "MYR" as const,
      },
    ];
    mockedFetch.mockResolvedValueOnce({ sources, skipped: [] });
    mockedAssign.mockResolvedValueOnce(
      new Map([
        ["crate_return:epic", "HDR-2606-011"],
        ["crate_return:tawakar", "EXP-2606-005"],
      ])
    );

    const preview = await buildArCrateReturnExportPreview({
      year: 2026,
      month: 6,
    });

    expect(preview.rowCount).toBe(2);
    expect(preview.totalAmount).toBe(1288);
    expect(preview.rows[0]).toMatchObject({
      docNo: "HDR-2606-011",
      debtorCode: "3002-E001",
      accNo: "5002-E001",
      taxType: "",
    });
    expect(preview.rows[1]).toMatchObject({
      docNo: "EXP-2606-005",
      debtorCode: "3000-T002",
      accNo: "5000-T002",
      taxType: "ESV-6",
    });
  });
});

describe("arCrateReturnCsvFilename", () => {
  it("includes year-month", () => {
    expect(arCrateReturnCsvFilename(2026, 6)).toBe(
      "ar-invoice-crate-return-2026-06.csv"
    );
  });
});
