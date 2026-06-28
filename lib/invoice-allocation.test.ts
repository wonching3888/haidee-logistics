import { describe, expect, it } from "vitest";
import {
  computeAutoFifoAllocations,
  computeInvoiceCollectionStatus,
  enrichCustomerLedgersWithCollection,
  enrichInvoicesWithCollection,
  roundMoney,
  validateManualAllocationRows,
  type AllocationInvoiceInput,
  type AllocationPaymentInput,
} from "./invoice-allocation";
import {
  groupReceivableCustomerLedgers,
  type ReceivableInvoice,
} from "./receivable-invoices";

function invoice(
  overrides: Partial<AllocationInvoiceInput> & Pick<AllocationInvoiceInput, "invoiceKey">
): AllocationInvoiceInput {
  return {
    invoiceType: "freight",
    yearMonth: "2026-01",
    sortDate: "2026-01-01",
    currency: "THB",
    totalAmount: 100,
    ...overrides,
  };
}

function payment(
  overrides: Partial<AllocationPaymentInput> & Pick<AllocationPaymentInput, "id">
): AllocationPaymentInput {
  return {
    amount: 100,
    paymentDate: "2026-06-01",
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeInvoiceCollectionStatus", () => {
  it("derives unpaid, partial, and paid from allocated vs total", () => {
    expect(computeInvoiceCollectionStatus(103_000, 0)).toBe("unpaid");
    expect(computeInvoiceCollectionStatus(103_000, 50_000)).toBe("partial");
    expect(computeInvoiceCollectionStatus(103_000, 103_000)).toBe("paid");
    expect(computeInvoiceCollectionStatus(103_000, 103_500)).toBe("paid");
  });
});

describe("computeAutoFifoAllocations", () => {
  it("★ user core example: Jan 103000 + Feb 210000, three 50000 payments", () => {
    const invoices = [
      invoice({
        invoiceKey: "freight:jan",
        yearMonth: "2026-01",
        sortDate: "2026-01-01",
        totalAmount: 103_000,
      }),
      invoice({
        invoiceKey: "freight:feb",
        yearMonth: "2026-02",
        sortDate: "2026-02-01",
        totalAmount: 210_000,
      }),
    ];

    const payment1 = payment({
      id: "p1",
      amount: 50_000,
      paymentDate: "2026-06-01",
      createdAt: "2026-06-01T08:00:00.000Z",
    });
    const payment2 = payment({
      id: "p2",
      amount: 50_000,
      paymentDate: "2026-06-02",
      createdAt: "2026-06-02T08:00:00.000Z",
    });
    const payment3 = payment({
      id: "p3",
      amount: 50_000,
      paymentDate: "2026-06-03",
      createdAt: "2026-06-03T08:00:00.000Z",
    });

    const after1 = computeAutoFifoAllocations({
      currency: "THB",
      invoices,
      payments: [payment1],
    });
    expect(after1.allocations).toEqual([
      expect.objectContaining({
        paymentId: "p1",
        invoiceKey: "freight:jan",
        amount: 50_000,
      }),
    ]);
    expect(after1.paymentUnallocated.p1).toBe(0);

    const after2 = computeAutoFifoAllocations({
      currency: "THB",
      invoices,
      payments: [payment1, payment2],
    });
    expect(after2.allocations).toEqual([
      expect.objectContaining({
        paymentId: "p1",
        invoiceKey: "freight:jan",
        amount: 50_000,
      }),
      expect.objectContaining({
        paymentId: "p2",
        invoiceKey: "freight:jan",
        amount: 50_000,
      }),
    ]);
    expect(after2.paymentUnallocated.p2).toBe(0);

    const after3 = computeAutoFifoAllocations({
      currency: "THB",
      invoices,
      payments: [payment1, payment2, payment3],
    });
    expect(after3.allocations).toEqual([
      expect.objectContaining({
        paymentId: "p1",
        invoiceKey: "freight:jan",
        amount: 50_000,
      }),
      expect.objectContaining({
        paymentId: "p2",
        invoiceKey: "freight:jan",
        amount: 50_000,
      }),
      expect.objectContaining({
        paymentId: "p3",
        invoiceKey: "freight:jan",
        amount: 3_000,
      }),
      expect.objectContaining({
        paymentId: "p3",
        invoiceKey: "freight:feb",
        amount: 47_000,
      }),
    ]);
    expect(after3.paymentUnallocated.p3).toBe(0);

    const allocatedByInvoice = new Map<string, number>();
    for (const row of after3.allocations) {
      const key = `${row.invoiceType}|${row.invoiceKey}`;
      allocatedByInvoice.set(
        key,
        roundMoney((allocatedByInvoice.get(key) ?? 0) + row.amount)
      );
    }

    expect(allocatedByInvoice.get("freight|freight:jan")).toBe(103_000);
    expect(allocatedByInvoice.get("freight|freight:feb")).toBe(47_000);
    expect(
      computeInvoiceCollectionStatus(
        103_000,
        allocatedByInvoice.get("freight|freight:jan") ?? 0
      )
    ).toBe("paid");
    expect(
      computeInvoiceCollectionStatus(
        210_000,
        allocatedByInvoice.get("freight|freight:feb") ?? 0
      )
    ).toBe("partial");
  });

  it("allocates one large payment across oldest invoices first", () => {
    const invoices = [
      invoice({
        invoiceKey: "freight:jan",
        yearMonth: "2026-01",
        totalAmount: 103_000,
      }),
      invoice({
        invoiceKey: "freight:feb",
        yearMonth: "2026-02",
        totalAmount: 210_000,
      }),
    ];

    const result = computeAutoFifoAllocations({
      currency: "THB",
      invoices,
      payments: [
        payment({
          id: "p1",
          amount: 150_000,
          paymentDate: "2026-06-01",
        }),
      ],
    });

    expect(result.allocations).toEqual([
      expect.objectContaining({
        invoiceKey: "freight:jan",
        amount: 103_000,
      }),
      expect.objectContaining({
        invoiceKey: "freight:feb",
        amount: 47_000,
      }),
    ]);
    expect(result.paymentUnallocated.p1).toBe(0);
  });

  it("records unallocatedAmount when payment exceeds all open invoices", () => {
    const result = computeAutoFifoAllocations({
      currency: "THB",
      invoices: [
        invoice({
          invoiceKey: "freight:jan",
          yearMonth: "2026-01",
          totalAmount: 100_000,
        }),
      ],
      payments: [
        payment({
          id: "p1",
          amount: 150_000,
        }),
      ],
    });

    expect(result.allocations).toEqual([
      expect.objectContaining({
        invoiceKey: "freight:jan",
        amount: 100_000,
      }),
    ]);
    expect(result.paymentUnallocated.p1).toBe(50_000);
  });

  it("keeps THB and MYR ledgers isolated", () => {
    const thbResult = computeAutoFifoAllocations({
      currency: "THB",
      invoices: [
        invoice({
          invoiceKey: "freight:thb",
          currency: "THB",
          totalAmount: 10_000,
        }),
        invoice({
          invoiceKey: "freight:myr",
          currency: "MYR",
          totalAmount: 99_999,
        }),
      ],
      payments: [
        payment({
          id: "p1",
          amount: 10_000,
        }),
      ],
    });

    expect(thbResult.allocations).toHaveLength(1);
    expect(thbResult.allocations[0]?.invoiceKey).toBe("freight:thb");
    expect(thbResult.allocations[0]?.currency).toBe("THB");

    const myrResult = computeAutoFifoAllocations({
      currency: "MYR",
      invoices: [
        invoice({
          invoiceKey: "freight:thb",
          currency: "THB",
          totalAmount: 10_000,
        }),
        invoice({
          invoiceKey: "freight:myr",
          currency: "MYR",
          totalAmount: 99_999,
        }),
      ],
      payments: [
        payment({
          id: "p2",
          amount: 5_000,
        }),
      ],
    });

    expect(myrResult.allocations).toHaveLength(1);
    expect(myrResult.allocations[0]?.invoiceKey).toBe("freight:myr");
    expect(myrResult.allocations[0]?.currency).toBe("MYR");
  });

  it("marks oldest invoice partial when payment is smaller than its total", () => {
    const invoices = [
      invoice({
        invoiceKey: "freight:jan",
        yearMonth: "2026-01",
        totalAmount: 103_000,
      }),
      invoice({
        invoiceKey: "freight:feb",
        yearMonth: "2026-02",
        totalAmount: 210_000,
      }),
    ];

    const result = computeAutoFifoAllocations({
      currency: "THB",
      invoices,
      payments: [
        payment({
          id: "p1",
          amount: 40_000,
        }),
      ],
    });

    expect(result.allocations).toEqual([
      expect.objectContaining({
        invoiceKey: "freight:jan",
        amount: 40_000,
      }),
    ]);

    const enriched = enrichInvoicesWithCollection(
      invoices.map((row) => ({
        invoiceType: row.invoiceType,
        invoiceKey: row.invoiceKey,
        invoiceNo: null,
        customerKey: "shipper:abc",
        customerKind: "shipper",
        customerId: "abc",
        customerCode: null,
        customerName: "Test",
        yearMonth: row.yearMonth,
        sortDate: row.sortDate,
        currency: row.currency,
        issuerKey: "haidee",
        totalAmount: row.totalAmount,
        sourceMeta: {},
        printHref: "/",
      })) as ReceivableInvoice[],
      new Map([["freight|freight:jan", 40_000]])
    );

    expect(enriched[0]?.collectionStatus).toBe("partial");
    expect(enriched[0]?.openAmount).toBe(63_000);
    expect(enriched[1]?.collectionStatus).toBe("unpaid");
  });

  it("is idempotent for the same inputs", () => {
    const input = {
      currency: "THB" as const,
      invoices: [
        invoice({
          invoiceKey: "freight:jan",
          yearMonth: "2026-01",
          totalAmount: 103_000,
        }),
        invoice({
          invoiceKey: "freight:feb",
          yearMonth: "2026-02",
          totalAmount: 210_000,
        }),
      ],
      payments: [
        payment({ id: "p1", amount: 50_000, paymentDate: "2026-06-01" }),
        payment({ id: "p2", amount: 50_000, paymentDate: "2026-06-02" }),
      ],
    };

    expect(computeAutoFifoAllocations(input)).toEqual(
      computeAutoFifoAllocations(input)
    );
  });

  it("updates status when live invoice total changes", () => {
    const enriched = enrichInvoicesWithCollection(
      [
        {
          invoiceType: "freight",
          invoiceKey: "freight:jan",
          invoiceNo: "INV-1",
          customerKey: "shipper:abc",
          customerKind: "shipper",
          customerId: "abc",
          customerCode: null,
          customerName: "Test",
          yearMonth: "2026-01",
          sortDate: "2026-01-01",
          currency: "THB",
          issuerKey: "haidee",
          totalAmount: 495,
          sourceMeta: {},
          printHref: "/",
        },
      ],
      new Map([["freight|freight:jan", 633]])
    );

    expect(enriched[0]?.collectionStatus).toBe("paid");
    expect(enriched[0]?.isOverAllocated).toBe(true);
    expect(enriched[0]?.openAmount).toBe(-138);
  });

  it("preserves manual allocations when auto FIFO reruns for other payments", () => {
    const invoices = [
      invoice({
        invoiceKey: "freight:jan",
        yearMonth: "2026-01",
        totalAmount: 103_000,
      }),
      invoice({
        invoiceKey: "freight:feb",
        yearMonth: "2026-02",
        totalAmount: 50_000,
      }),
    ];

    const manualAllocations = [
      {
        paymentId: "p-manual",
        invoiceType: "freight" as const,
        invoiceKey: "freight:jan",
        amount: 20_000,
      },
    ];

    const result = computeAutoFifoAllocations({
      currency: "THB",
      invoices,
      payments: [
        payment({ id: "p-manual", amount: 50_000, paymentDate: "2026-06-01" }),
        payment({ id: "p-new", amount: 50_000, paymentDate: "2026-06-02" }),
      ],
      manualAllocations,
    });

    const autoToJan = result.allocations
      .filter((row) => row.paymentId === "p-manual" && row.invoiceKey === "freight:jan")
      .reduce((sum, row) => sum + row.amount, 0);
    expect(autoToJan).toBe(30_000);
    expect(result.paymentUnallocated["p-manual"]).toBe(0);

    const autoFromNew = result.allocations.filter((row) => row.paymentId === "p-new");
    expect(autoFromNew.reduce((sum, row) => sum + row.amount, 0)).toBe(50_000);
    expect(result.paymentUnallocated["p-new"]).toBe(0);
  });

  it("reallocates correctly after removing the first payment (delete simulation)", () => {
    const invoices = [
      invoice({
        invoiceKey: "freight:jan",
        yearMonth: "2026-01",
        totalAmount: 103_000,
      }),
    ];

    const withTwo = computeAutoFifoAllocations({
      currency: "THB",
      invoices,
      payments: [
        payment({ id: "p1", amount: 50_000, paymentDate: "2026-06-01" }),
        payment({ id: "p2", amount: 50_000, paymentDate: "2026-06-02" }),
      ],
    });

    const afterDelete = computeAutoFifoAllocations({
      currency: "THB",
      invoices,
      payments: [payment({ id: "p2", amount: 50_000, paymentDate: "2026-06-02" })],
    });

    expect(
      withTwo.allocations
        .filter((row) => row.paymentId === "p1")
        .reduce((sum, row) => sum + row.amount, 0)
    ).toBe(50_000);
    expect(
      afterDelete.allocations.reduce((sum, row) => sum + row.amount, 0)
    ).toBe(50_000);
    expect(afterDelete.allocations[0]?.paymentId).toBe("p2");
  });
});

describe("validateManualAllocationRows", () => {
  it("rejects manual sum above payment amount", () => {
    expect(() =>
      validateManualAllocationRows({
        paymentAmount: 10_000,
        currency: "MYR",
        customerKey: "shipper:abc",
        allocations: [
          { invoiceType: "freight", invoiceKey: "freight:jan", amount: 12_000 },
        ],
        invoices: [
          {
            invoiceType: "freight",
            invoiceKey: "freight:jan",
            invoiceNo: null,
            customerKey: "shipper:abc",
            customerKind: "shipper",
            customerId: "abc",
            customerCode: null,
            customerName: "Test",
            yearMonth: "2026-01",
            sortDate: "2026-01-01",
            currency: "MYR",
            issuerKey: "haidee",
            totalAmount: 50_000,
            sourceMeta: {},
            printHref: "/",
          },
        ],
        allocatedByInvoiceExcludingPayment: new Map(),
      })
    ).toThrow(/不能超过来款|cannot exceed/i);
  });

  it("requires confirmOverAllocation when invoice would be over-allocated", () => {
    expect(() =>
      validateManualAllocationRows({
        paymentAmount: 20_000,
        currency: "MYR",
        customerKey: "shipper:abc",
        allocations: [
          { invoiceType: "freight", invoiceKey: "freight:jan", amount: 15_000 },
        ],
        invoices: [
          {
            invoiceType: "freight",
            invoiceKey: "freight:jan",
            invoiceNo: null,
            customerKey: "shipper:abc",
            customerKind: "shipper",
            customerId: "abc",
            customerCode: null,
            customerName: "Test",
            yearMonth: "2026-01",
            sortDate: "2026-01-01",
            currency: "MYR",
            issuerKey: "haidee",
            totalAmount: 10_000,
            sourceMeta: {},
            printHref: "/",
          },
        ],
        allocatedByInvoiceExcludingPayment: new Map([
          ["freight|freight:jan", 5_000],
        ]),
      })
    ).toThrow(/超过总额|over-allocated/i);
  });
});

describe("enrichCustomerLedgersWithCollection", () => {
  it("aggregates allocated/open/status per customerKey+currency ledger", () => {
    const invoices: ReceivableInvoice[] = [
      {
        invoiceType: "freight",
        invoiceKey: "freight:jan",
        invoiceNo: "INV-1",
        customerKey: "shipper:abc",
        customerKind: "shipper",
        customerId: "abc",
        customerCode: "B002",
        customerName: "Best Brother",
        yearMonth: "2026-01",
        sortDate: "2026-01-01",
        currency: "MYR",
        issuerKey: "haidee",
        totalAmount: 67_118.06,
        sourceMeta: {},
        printHref: "/",
      },
      {
        invoiceType: "freight",
        invoiceKey: "freight:feb",
        invoiceNo: "INV-2",
        customerKey: "shipper:abc",
        customerKind: "shipper",
        customerId: "abc",
        customerCode: "B002",
        customerName: "Best Brother",
        yearMonth: "2026-02",
        sortDate: "2026-02-01",
        currency: "MYR",
        issuerKey: "haidee",
        totalAmount: 100,
        sourceMeta: {},
        printHref: "/",
      },
      {
        invoiceType: "freight",
        invoiceKey: "freight:thb",
        invoiceNo: "INV-3",
        customerKey: "shipper:abc",
        customerKind: "shipper",
        customerId: "abc",
        customerCode: "B002",
        customerName: "Best Brother",
        yearMonth: "2026-01",
        sortDate: "2026-01-01",
        currency: "THB",
        issuerKey: "haidee",
        totalAmount: 500,
        sourceMeta: {},
        printHref: "/",
      },
    ];

    const ledgers = groupReceivableCustomerLedgers(invoices);
    const allocatedByInvoice = new Map<string, number>([
      ["freight|freight:jan", 10_000],
      ["freight|freight:feb", 0],
      ["freight|freight:thb", 500],
    ]);
    const unallocatedByLedger = new Map<string, number>([
      ["shipper:abc|MYR", 1_000],
    ]);

    const enriched = enrichCustomerLedgersWithCollection(
      ledgers,
      invoices,
      allocatedByInvoice,
      unallocatedByLedger
    );

    const myr = enriched.find((row) => row.currency === "MYR");
    const thb = enriched.find((row) => row.currency === "THB");

    expect(myr?.totalReceivable).toBe(67_218.06);
    expect(myr?.totalAllocated).toBe(10_000);
    expect(myr?.totalOpen).toBe(57_218.06);
    expect(myr?.collectionStatus).toBe("partial");
    expect(myr?.hasPrepayment).toBe(true);
    expect(myr?.prepaymentAmount).toBe(1_000);

    expect(thb?.totalAllocated).toBe(500);
    expect(thb?.totalOpen).toBe(0);
    expect(thb?.collectionStatus).toBe("paid");
    expect(thb?.hasPrepayment).toBe(false);
  });

  it("preserves ledger sort order from input", () => {
    const ledgers = [
      {
        customerKey: "shipper:a",
        customerKind: "shipper" as const,
        customerId: "a",
        customerCode: null,
        customerName: "Alpha",
        currency: "THB" as const,
        earliestYearMonth: "2026-01",
        totalReceivable: 100,
        invoiceCount: 1,
      },
      {
        customerKey: "shipper:b",
        customerKind: "shipper" as const,
        customerId: "b",
        customerCode: null,
        customerName: "Bravo",
        currency: "THB" as const,
        earliestYearMonth: "2026-03",
        totalReceivable: 200,
        invoiceCount: 1,
      },
    ];

    const enriched = enrichCustomerLedgersWithCollection(
      ledgers,
      [],
      new Map(),
      new Map()
    );

    expect(enriched.map((row) => row.customerName)).toEqual(["Alpha", "Bravo"]);
    expect(enriched[0]?.collectionStatus).toBe("unpaid");
  });
});

describe("invoice collections permissions", () => {
  it("allows admin to record payments and viewer read-only", async () => {
    const { canViewInvoiceCollections, canWriteInvoiceCollections } = await import(
      "./auth-roles"
    );
    expect(canWriteInvoiceCollections("admin")).toBe(true);
    expect(canWriteInvoiceCollections("viewer")).toBe(false);
    expect(canWriteInvoiceCollections("clerk")).toBe(false);
    expect(canViewInvoiceCollections("viewer")).toBe(true);
    expect(canViewInvoiceCollections("admin")).toBe(true);
  });
});
