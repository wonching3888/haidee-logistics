import { describe, expect, it } from "vitest";
import type {
  InvoicePaymentView,
  ReceivableInvoiceWithCollection,
} from "@/lib/invoice-allocation";
import {
  buildDebtorStatement,
  buildDebtorStatementAging,
} from "@/lib/invoice-collections-statement";

function makeInvoice(
  overrides: Partial<ReceivableInvoiceWithCollection> &
    Pick<
      ReceivableInvoiceWithCollection,
      "invoiceKey" | "sortDate" | "totalAmount" | "openAmount"
    >
): ReceivableInvoiceWithCollection {
  return {
    invoiceType: "freight",
    invoiceNo: overrides.invoiceNo ?? overrides.invoiceKey,
    customerKey: "shipper:test",
    customerKind: "shipper",
    customerId: "c1",
    customerCode: "T001",
    customerName: "Test Customer",
    yearMonth: overrides.sortDate.slice(0, 7),
    currency: "MYR",
    issuerKey: "haidee",
    sourceMeta: {},
    printHref: "/documents/test",
    allocatedAmount: overrides.totalAmount - overrides.openAmount,
    collectionStatus:
      overrides.openAmount <= 0
        ? "paid"
        : overrides.openAmount < overrides.totalAmount
          ? "partial"
          : "unpaid",
    isOverAllocated: false,
    ...overrides,
  };
}

function makePayment(
  overrides: Partial<InvoicePaymentView> &
    Pick<InvoicePaymentView, "id" | "paymentDate" | "amount">
): InvoicePaymentView {
  return {
    bankAccount: "MAYBANK",
    allocatedAmount: overrides.amount,
    unallocatedAmount: 0,
    notes: null,
    allocationStrategy: "auto",
    allocations: [],
    ...overrides,
  };
}

const labels = new Map<string, string>([
  ["freight|INV-JUN", "车力 2026-06"],
  ["freight|INV-JUL-1", "车力 2026-07"],
  ["freight|INV-JUL-2", "车力 2026-07"],
  ["freight|INV-OLD", "车力 2025-12"],
  ["freight|INV-MID", "车力 2026-05"],
  ["freight|INV-A", "车力 2026-04"],
  ["freight|INV-B", "车力 2026-05"],
  ["freight|INV-C", "车力 2026-06"],
]);

describe("buildDebtorStatement", () => {
  const invoices = [
    makeInvoice({
      invoiceKey: "INV-JUN",
      sortDate: "2026-06-15",
      totalAmount: 1000,
      openAmount: 400,
    }),
    makeInvoice({
      invoiceKey: "INV-JUL-1",
      sortDate: "2026-07-01",
      totalAmount: 500,
      openAmount: 500,
    }),
    makeInvoice({
      invoiceKey: "INV-JUL-2",
      sortDate: "2026-07-20",
      totalAmount: 300,
      openAmount: 100,
    }),
  ];
  const payments = [
    makePayment({
      id: "pay-jun",
      paymentDate: "2026-06-28",
      amount: 600,
      notes: "June partial",
    }),
    makePayment({
      id: "pay-jul",
      paymentDate: "2026-07-10",
      amount: 200,
      notes: "July payment",
    }),
  ];

  it("full range matches unsliced opening (0) and closing balances", () => {
    const statement = buildDebtorStatement({
      invoices,
      payments,
      invoiceLabels: labels,
      range: { from: "2026-01-01", to: "2026-12-31" },
    });
    expect(statement.openingBalance).toBe(0);
    // 1000 - 600 + 500 - 200 + 300 = 1000
    expect(statement.closingBalance).toBe(1000);
    expect(statement.entries).toHaveLength(5);
    expect(statement.totalCharge).toBe(1800);
    expect(statement.totalCredit).toBe(800);
  });

  it("carries prior transactions into openingBalance and excludes them from entries", () => {
    const statement = buildDebtorStatement({
      invoices,
      payments,
      invoiceLabels: labels,
      range: { from: "2026-07-01", to: "2026-07-31" },
    });
    // June: +1000 -600 = 400 opening
    expect(statement.openingBalance).toBe(400);
    expect(statement.entries.map((e) => e.id)).toEqual([
      "freight:INV-JUL-1",
      "pay-jul",
      "freight:INV-JUL-2",
    ]);
    // 400 + 500 - 200 + 300 = 1000
    expect(statement.closingBalance).toBe(1000);
    expect(statement.totalCharge).toBe(800);
    expect(statement.totalCredit).toBe(200);
  });

  it("empty period keeps entries empty and closing === opening with zero totals", () => {
    const statement = buildDebtorStatement({
      invoices,
      payments,
      invoiceLabels: labels,
      range: { from: "2026-08-01", to: "2026-08-31" },
    });
    expect(statement.entries).toHaveLength(0);
    expect(statement.openingBalance).toBe(1000);
    expect(statement.closingBalance).toBe(1000);
    expect(statement.totalCharge).toBe(0);
    expect(statement.totalCredit).toBe(0);
  });

  it("includes boundary dates and excludes the day before from", () => {
    const statement = buildDebtorStatement({
      invoices,
      payments,
      invoiceLabels: labels,
      range: { from: "2026-06-28", to: "2026-07-01" },
    });
    expect(statement.openingBalance).toBe(1000); // only INV-JUN before 06-28
    expect(statement.entries.map((e) => e.id)).toEqual([
      "pay-jun",
      "freight:INV-JUL-1",
    ]);
    // 1000 - 600 + 500 = 900
    expect(statement.closingBalance).toBe(900);
  });

  it("partial payment across months yields correct closingBalance", () => {
    // Realistic: invoice 1000 in June, pay 400 in June, pay 250 in July → open 350
    const inv = [
      makeInvoice({
        invoiceKey: "INV-JUN",
        sortDate: "2026-06-10",
        totalAmount: 1000,
        openAmount: 350,
      }),
    ];
    const pays = [
      makePayment({ id: "p1", paymentDate: "2026-06-20", amount: 400 }),
      makePayment({ id: "p2", paymentDate: "2026-07-05", amount: 250 }),
    ];
    const july = buildDebtorStatement({
      invoices: inv,
      payments: pays,
      invoiceLabels: labels,
      range: { from: "2026-07-01", to: "2026-07-31" },
    });
    expect(july.openingBalance).toBe(600); // 1000 - 400
    expect(july.closingBalance).toBe(350); // 600 - 250
    expect(july.closingBalance).toBe(inv[0]!.openAmount);
  });
});

describe("buildDebtorStatementAging", () => {
  it("bucket sum equals sum of all openAmount > 0 (independent identity)", () => {
    const invoices = [
      makeInvoice({
        invoiceKey: "INV-A",
        sortDate: "2026-04-01",
        totalAmount: 1000,
        openAmount: 400,
      }),
      makeInvoice({
        invoiceKey: "INV-B",
        sortDate: "2026-05-20",
        totalAmount: 500,
        openAmount: 500,
      }),
      makeInvoice({
        invoiceKey: "INV-C",
        sortDate: "2026-06-25",
        totalAmount: 200,
        openAmount: 0,
      }),
      makeInvoice({
        invoiceKey: "INV-MID",
        sortDate: "2026-06-01",
        totalAmount: 300,
        openAmount: 150.55,
      }),
    ];
    const expectedOpen = invoices
      .filter((i) => i.openAmount > 0)
      .reduce((s, i) => Math.round((s + i.openAmount) * 100) / 100, 0);

    const aging = buildDebtorStatementAging({
      invoices,
      asOfDate: "2026-07-17",
    });
    expect(aging.total).toBe(expectedOpen);
    expect(
      Math.round(
        aging.buckets.reduce((s, b) => s + b.amount, 0) * 100
      ) / 100
    ).toBe(expectedOpen);
  });

  it("assigns buckets by invoice date age from asOfDate", () => {
    const invoices = [
      makeInvoice({
        invoiceKey: "INV-OLD",
        sortDate: "2025-12-01",
        totalAmount: 100,
        openAmount: 100,
      }), // 90+
      makeInvoice({
        invoiceKey: "INV-A",
        sortDate: "2026-05-01",
        totalAmount: 200,
        openAmount: 200,
      }), // 61-90 from 2026-07-17 → 77 days
      makeInvoice({
        invoiceKey: "INV-B",
        sortDate: "2026-06-01",
        totalAmount: 300,
        openAmount: 300,
      }), // 31-60 → 46 days
      makeInvoice({
        invoiceKey: "INV-C",
        sortDate: "2026-07-10",
        totalAmount: 50,
        openAmount: 50,
      }), // 0-30 → 7 days
    ];
    const aging = buildDebtorStatementAging({
      invoices,
      asOfDate: "2026-07-17",
    });
    const byKey = Object.fromEntries(
      aging.buckets.map((b) => [b.key, b.amount])
    );
    expect(byKey["0-30"]).toBe(50);
    expect(byKey["31-60"]).toBe(300);
    expect(byKey["61-90"]).toBe(200);
    expect(byKey["90+"]).toBe(100);
    expect(aging.total).toBe(650);
  });
});
