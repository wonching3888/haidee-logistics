import { describe, expect, it } from "vitest";
import {
  buildReceivableCustomerKey,
  compareReceivableInvoices,
  groupReceivableCustomerLedgers,
  normalizeCharterManualCustomerName,
  summarizeReceivableOverview,
  type ReceivableInvoice,
} from "./receivable-invoices";

function sampleInvoice(
  overrides: Partial<ReceivableInvoice> & Pick<ReceivableInvoice, "invoiceKey">
): ReceivableInvoice {
  return {
    invoiceType: "freight",
    invoiceNo: "TEST-001",
    customerKey: "shipper:abc",
    customerKind: "shipper",
    customerId: "abc",
    customerCode: "A001",
    customerName: "Alpha",
    yearMonth: "2026-01",
    sortDate: "2026-01-01",
    currency: "THB",
    issuerKey: "haidee",
    totalAmount: 100,
    sourceMeta: {},
    printHref: "/documents/monthly-invoice/print",
    ...overrides,
  };
}

describe("normalizeCharterManualCustomerName", () => {
  it("trims and uppercases manual charter names", () => {
    expect(normalizeCharterManualCustomerName("  foo   bar  ")).toBe("FOO BAR");
  });
});

describe("buildReceivableCustomerKey", () => {
  it("builds shipper and manual keys", () => {
    expect(buildReceivableCustomerKey("shipper", "uuid-1")).toBe("shipper:uuid-1");
    expect(buildReceivableCustomerKey("charter_manual", "foo bar")).toBe(
      "charter_manual:FOO BAR"
    );
  });
});

describe("compareReceivableInvoices", () => {
  it("sorts old to new by yearMonth then sortDate", () => {
    const older = sampleInvoice({
      invoiceKey: "a",
      yearMonth: "2026-01",
      sortDate: "2026-01-01",
    });
    const newer = sampleInvoice({
      invoiceKey: "b",
      yearMonth: "2026-02",
      sortDate: "2026-02-01",
    });
    expect(compareReceivableInvoices(older, newer)).toBeLessThan(0);
    expect(compareReceivableInvoices(newer, older)).toBeGreaterThan(0);
  });
});

describe("groupReceivableCustomerLedgers", () => {
  it("splits ledgers by customerKey and currency", () => {
    const ledgers = groupReceivableCustomerLedgers([
      sampleInvoice({
        invoiceKey: "f1",
        customerKey: "shipper:abc",
        customerName: "Alpha",
        currency: "THB",
        yearMonth: "2026-01",
        totalAmount: 100,
      }),
      sampleInvoice({
        invoiceKey: "f2",
        customerKey: "shipper:abc",
        customerName: "Alpha",
        currency: "MYR",
        yearMonth: "2026-02",
        totalAmount: 200,
      }),
      sampleInvoice({
        invoiceKey: "f3",
        customerKey: "shipper:abc",
        customerName: "Alpha",
        currency: "THB",
        yearMonth: "2026-03",
        totalAmount: 50,
      }),
    ]);

    expect(ledgers).toHaveLength(2);
    const thb = ledgers.find((row) => row.currency === "THB");
    const myr = ledgers.find((row) => row.currency === "MYR");
    expect(thb?.totalReceivable).toBe(150);
    expect(thb?.invoiceCount).toBe(2);
    expect(thb?.earliestYearMonth).toBe("2026-01");
    expect(myr?.totalReceivable).toBe(200);
  });

  it("sorts ledgers by earliest yearMonth ascending", () => {
    const ledgers = groupReceivableCustomerLedgers([
      sampleInvoice({
        invoiceKey: "b",
        customerKey: "shipper:b",
        customerName: "Bravo",
        yearMonth: "2026-03",
      }),
      sampleInvoice({
        invoiceKey: "a",
        customerKey: "shipper:a",
        customerName: "Alpha",
        yearMonth: "2026-01",
      }),
    ]);

    expect(ledgers[0]?.customerName).toBe("Alpha");
    expect(ledgers[1]?.customerName).toBe("Bravo");
  });
});

describe("summarizeReceivableOverview", () => {
  it("totals by currency", () => {
    const overview = summarizeReceivableOverview([
      sampleInvoice({ invoiceKey: "a", currency: "THB", totalAmount: 10 }),
      sampleInvoice({ invoiceKey: "b", currency: "THB", totalAmount: 20 }),
      sampleInvoice({ invoiceKey: "c", currency: "MYR", totalAmount: 5 }),
    ]);

    expect(overview.thb.totalReceivable).toBe(30);
    expect(overview.thb.invoiceCount).toBe(2);
    expect(overview.myr.totalReceivable).toBe(5);
    expect(overview.myr.invoiceCount).toBe(1);
  });
});
