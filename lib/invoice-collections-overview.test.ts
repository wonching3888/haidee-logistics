import { describe, expect, it } from "vitest";
import {
  buildInvoiceCollectionsOverview,
  filterInvoiceCollectionLedgers,
  hasActiveListFilters,
  parseInvoiceCollectionsListFilters,
  type LedgerWithCollectionRow,
} from "./invoice-collections-overview";
import { ledgerCollectionKey } from "./invoice-allocation";
import type { ReceivableInvoice } from "./receivable-invoices";

function receivableInvoice(
  overrides: Partial<ReceivableInvoice> &
    Pick<ReceivableInvoice, "invoiceKey" | "currency" | "totalAmount">
): ReceivableInvoice {
  return {
    invoiceType: "freight",
    yearMonth: "2026-06",
    sortDate: "2026-06-01",
    customerKey: "shipper:1",
    customerKind: "shipper",
    customerId: "1",
    customerName: "Acme",
    customerCode: "ACME",
    invoiceNo: "INV-1",
    issuerKey: "haidee",
    printHref: "/print/1",
    sourceMeta: {},
    ...overrides,
  };
}

describe("buildInvoiceCollectionsOverview", () => {
  it("derives open receivable and bank breakdown from aggregated inputs", () => {
    const invoices = [
      receivableInvoice({
        invoiceKey: "a",
        currency: "THB",
        totalAmount: 1000,
        customerKey: "shipper:1",
      }),
      receivableInvoice({
        invoiceKey: "b",
        currency: "THB",
        totalAmount: 500,
        customerKey: "shipper:2",
      }),
      receivableInvoice({
        invoiceKey: "c",
        currency: "MYR",
        totalAmount: 200,
        customerKey: "shipper:3",
      }),
    ];

    const allocatedByInvoice = new Map<string, number>([
      ["freight|a", 400],
      ["freight|b", 500],
      ["freight|c", 50],
    ]);

    const bankAmountsByCurrency = {
      THB: new Map([
        ["HAIDEE_BBL5030", 700] as const,
        ["CASH", 100] as const,
      ]),
      MYR: new Map([["WTL_PBB1725", 120] as const]),
    };

    const overview = buildInvoiceCollectionsOverview({
      invoices,
      allocatedByInvoice,
      paymentTotalsByCurrency: {
        THB: { received: 800, prepaid: 150 },
        MYR: { received: 120, prepaid: 70 },
      },
      bankAmountsByCurrency,
    });

    expect(overview.thb.totalReceivable).toBe(1500);
    expect(overview.thb.totalAllocated).toBe(900);
    expect(overview.thb.totalReceived).toBe(800);
    expect(overview.thb.totalPrepaid).toBe(150);
    expect(overview.thb.totalOpen).toBe(600);
    expect(overview.thb.invoiceCount).toBe(2);

    const thbBankTotal = overview.thb.bankAccounts.reduce(
      (sum, row) => sum + row.amount,
      0
    );
    expect(thbBankTotal).toBe(overview.thb.totalReceived);

    expect(overview.myr.totalReceivable).toBe(200);
    expect(overview.myr.totalOpen).toBe(150);
    expect(
      overview.myr.bankAccounts.reduce((sum, row) => sum + row.amount, 0)
    ).toBe(120);
  });
});

describe("filterInvoiceCollectionLedgers", () => {
  const ledgers: LedgerWithCollectionRow[] = [
    {
      customerKey: "shipper:1",
      currency: "THB",
      customerName: "Alpha Logistics",
      customerCode: "ALPHA",
      collectionStatus: "unpaid",
    },
    {
      customerKey: "shipper:2",
      currency: "MYR",
      customerName: "Beta Trading",
      customerCode: "BETA",
      collectionStatus: "paid",
    },
    {
      customerKey: "shipper:3",
      currency: "THB",
      customerName: "Gamma Co",
      customerCode: null,
      collectionStatus: "partial",
    },
  ];

  const ledgerBankAccounts = new Map<string, Array<"HAIDEE_BBL5030" | "WTL_PBB1725">>([
    [ledgerCollectionKey("shipper:1", "THB"), ["HAIDEE_BBL5030"]],
    [ledgerCollectionKey("shipper:2", "MYR"), ["WTL_PBB1725"]],
    [ledgerCollectionKey("shipper:3", "THB"), ["HAIDEE_BBL5030"]],
  ]);

  it("filters by status, currency, customer query, and bank account", () => {
    expect(
      filterInvoiceCollectionLedgers(ledgers, ledgerBankAccounts, {
        customerQuery: "",
        bankAccount: "",
        status: "unpaid",
        currency: "",
      }).map((row) => row.customerKey)
    ).toEqual(["shipper:1"]);

    expect(
      filterInvoiceCollectionLedgers(ledgers, ledgerBankAccounts, {
        customerQuery: "",
        bankAccount: "",
        status: "",
        currency: "MYR",
      }).map((row) => row.customerKey)
    ).toEqual(["shipper:2"]);

    expect(
      filterInvoiceCollectionLedgers(ledgers, ledgerBankAccounts, {
        customerQuery: "beta",
        bankAccount: "",
        status: "",
        currency: "",
      }).map((row) => row.customerKey)
    ).toEqual(["shipper:2"]);

    expect(
      filterInvoiceCollectionLedgers(ledgers, ledgerBankAccounts, {
        customerQuery: "",
        bankAccount: "HAIDEE_BBL5030",
        status: "",
        currency: "",
      }).map((row) => row.customerKey)
    ).toEqual(["shipper:1", "shipper:3"]);
  });
});

describe("parseInvoiceCollectionsListFilters", () => {
  it("parses list filter URL params", () => {
    const params = new URLSearchParams({
      listCustomer: " acme ",
      listBank: "WTL_PBB1725",
      listStatus: "partial",
      listCurrency: "THB",
    });

    expect(parseInvoiceCollectionsListFilters(params)).toEqual({
      customerQuery: "acme",
      bankAccount: "WTL_PBB1725",
      status: "partial",
      currency: "THB",
    });
    expect(
      hasActiveListFilters(parseInvoiceCollectionsListFilters(new URLSearchParams()))
    ).toBe(false);
  });
});
