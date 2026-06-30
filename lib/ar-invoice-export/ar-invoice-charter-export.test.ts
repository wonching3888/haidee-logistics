import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mapReceivableInvoiceToArCharterSource,
} from "@/lib/ar-invoice-export/ar-invoice-charter-fetcher";
import {
  arCharterCsvFilename,
  buildArCharterExportPreview,
} from "@/lib/ar-invoice-export/ar-invoice-charter-export";
import type { ReceivableInvoice } from "@/lib/receivable-invoices";

vi.mock("@/lib/ar-invoice-export/ar-invoice-charter-fetcher", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/ar-invoice-export/ar-invoice-charter-fetcher")
  >("@/lib/ar-invoice-export/ar-invoice-charter-fetcher");
  return {
    ...actual,
    fetchCharterAmountsForMonthWithSkips: vi.fn(),
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

import { fetchCharterAmountsForMonthWithSkips } from "@/lib/ar-invoice-export/ar-invoice-charter-fetcher";
import { assignDocNosForSources } from "@/lib/ar-invoice-export/ar-invoice-docno-registry";

const mockedFetch = vi.mocked(fetchCharterAmountsForMonthWithSkips);
const mockedAssign = vi.mocked(assignDocNosForSources);

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetch.mockReset();
  mockedAssign.mockReset();
});

function charterInvoice(
  overrides: Partial<ReceivableInvoice> & Pick<ReceivableInvoice, "invoiceKey">
): ReceivableInvoice {
  return {
    invoiceType: "charter",
    invoiceNo: "CH-001",
    customerKey: "shipper:ship-1",
    customerKind: "shipper",
    customerId: "ship-1",
    customerCode: "3002-H002",
    customerName: "Consignee H",
    yearMonth: "2026-06",
    sortDate: "2026-06-18",
    currency: "MYR",
    issuerKey: "haidee",
    totalAmount: 1500,
    sourceMeta: { charterNo: "CH-001", billingCompany: "haidee", billToKind: "shipper" },
    printHref: "/charter/1/invoice",
    ...overrides,
  };
}

describe("mapReceivableInvoiceToArCharterSource", () => {
  it("maps charter with customer code and trip date", () => {
    const invoice = charterInvoice({ invoiceKey: "charter:trip-1" });
    const mapped = mapReceivableInvoiceToArCharterSource(invoice, 2026, 6);
    expect(mapped).toMatchObject({
      entityKey: "charter:trip-1",
      debtorCode: "3002-H002",
      tripDate: "2026-06-18",
      amount: 1500,
      mode: "charter",
    });
  });

  it("skips manual customer without code", () => {
    const invoice = charterInvoice({
      invoiceKey: "charter:manual",
      customerKind: "charter_manual",
      customerId: null,
      customerCode: null,
      customerName: "Manual Name",
      customerKey: "charter_manual:Manual Name",
    });
    expect(mapReceivableInvoiceToArCharterSource(invoice, 2026, 6)).toBeNull();
  });
});

describe("buildArCharterExportPreview", () => {
  it("builds HDR- rows with trip date description and reports skipped manual customers", async () => {
    const sources = [
      {
        revenueKind: "charter" as const,
        entityKey: "charter:t1",
        mode: "charter" as const,
        debtorCode: "3002-H002",
        debtorName: "Consignee H",
        year: 2026,
        month: 6,
        tripDate: "2026-06-18",
        amount: 1500,
        currency: "MYR" as const,
      },
    ];
    const skipped = [
      {
        entityKey: "charter:manual",
        charterNo: "CH-99",
        customerName: "Walk-in",
        tripDate: "2026-06-20",
        reason: "无客户 code（手动输入名字）",
      },
    ];
    mockedFetch.mockResolvedValueOnce({ sources, skipped });
    mockedAssign.mockResolvedValueOnce(
      new Map([["charter:t1", "HDR-2606-011"]])
    );

    const preview = await buildArCharterExportPreview({
      year: 2026,
      month: 6,
    });

    expect(preview.rowCount).toBe(1);
    expect(preview.totalAmount).toBe(1500);
    expect(preview.docNoFirst).toBe("HDR-2606-011");
    expect(preview.rows[0]?.tripDate).toBe("2026-6-18");
    expect(preview.skipped).toHaveLength(1);
    expect(preview.skipped[0]?.customerName).toBe("Walk-in");
  });
});

describe("arCharterCsvFilename", () => {
  it("includes year-month", () => {
    expect(arCharterCsvFilename(2026, 6)).toBe("ar-invoice-charter-2026-06.csv");
  });
});
