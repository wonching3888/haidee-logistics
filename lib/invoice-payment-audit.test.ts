import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveHistoryEntityTypes } from "@/lib/audit-feed";
import {
  buildInvoicePaymentDeleteMetadata,
  diffInvoicePaymentFieldChanges,
  dateToAuditString,
  invoiceCollectionsDeepLink,
  invoicePaymentAuditEventLabel,
  summarizeAllocations,
} from "@/lib/invoice-payment-audit";

describe("diffInvoicePaymentFieldChanges", () => {
  it("detects amount and bank account changes", () => {
    const changes = diffInvoicePaymentFieldChanges(
      {
        amount: 1000,
        paymentDate: new Date("2026-06-01T00:00:00.000Z"),
        bankAccount: "HAIDEE_BBL5030",
        notes: "old",
        customerKey: "shipper:1",
        currency: "THB",
      },
      {
        amount: 1200,
        paymentDate: new Date("2026-06-01T00:00:00.000Z"),
        bankAccount: "CASH",
        notes: "old",
        customerKey: "shipper:1",
        currency: "THB",
      }
    );

    expect(changes).toEqual([
      {
        field: "amount",
        fromValue: "1000.00",
        toValue: "1200.00",
      },
      {
        field: "bankAccount",
        fromValue: "HAIDEE_BBL5030",
        toValue: "CASH",
      },
    ]);
  });
});

describe("dateToAuditString", () => {
  it("accepts Date and ISO date strings", () => {
    expect(dateToAuditString(new Date("2026-06-15T00:00:00.000Z"))).toBe(
      "2026-06-15"
    );
    expect(dateToAuditString("2026-06-15")).toBe("2026-06-15");
  });
});

describe("buildInvoicePaymentDeleteMetadata", () => {
  it("serializes db-shaped payment fields without calling toISOString on caller", () => {
    const metadata = buildInvoicePaymentDeleteMetadata({
      customerKey: "shipper:best-brother",
      customerKind: "shipper",
      customerName: "BEST BROTHER FISHERY",
      currency: "THB",
      amount: "50000.00",
      paymentDate: "2026-06-15",
      bankAccount: "WTL_PBB_1725",
      notes: "test 50000",
      allocationsBefore: [
        {
          invoiceType: "freight",
          invoiceKey: "2026-06",
          yearMonth: "2026-06",
          amount: 31533.1,
        },
      ],
      unallocatedBefore: "18466.90",
    }) as Record<string, unknown>;

    expect(metadata.paymentDate).toBe("2026-06-15");
    expect(metadata.amount).toBe(50000);
    expect(metadata.unallocatedBefore).toBe(18466.9);
    expect(metadata.notes).toBe("test 50000");
    expect(metadata.allocationsBeforeSummary).toBe(
      "2026-06 freight|2026-06: 31533.10"
    );
    expect(JSON.stringify(metadata)).not.toContain("undefined");
  });
});

describe("summarizeAllocations", () => {
  it("formats allocation rows for audit metadata", () => {
    expect(
      summarizeAllocations([
        {
          invoiceType: "freight",
          invoiceKey: "jan",
          yearMonth: "2026-01",
          amount: 50000,
          isManual: true,
        },
      ])
    ).toBe("2026-01 freight|jan: 50000.00 [手动]");
  });
});

describe("invoice payment audit labels", () => {
  it("maps event types to Chinese labels", () => {
    expect(invoicePaymentAuditEventLabel("create")).toBe("录款");
    expect(invoicePaymentAuditEventLabel("manual_override")).toBe("手动冲账");
  });
});

describe("invoiceCollectionsDeepLink", () => {
  it("builds customer ledger deep link", () => {
    expect(
      invoiceCollectionsDeepLink({
        customerKey: "shipper:abc",
        currency: "THB",
      })
    ).toBe(
      "/financial/invoice-collections?customerKey=shipper%3Aabc&currency=THB&q=1"
    );
  });
});

describe("resolveHistoryEntityTypes", () => {
  it("includes invoice_payment in all tab", () => {
    expect(resolveHistoryEntityTypes(undefined)).toContain("invoice_payment");
  });

  it("filters invoice collections tab", () => {
    expect(resolveHistoryEntityTypes("invoice_collections")).toEqual([
      "invoice_payment",
    ]);
  });
});

describe("manual-only audit policy", () => {
  it("runAutoAllocation does not write invoice payment audit logs", () => {
    const source = readFileSync(
      resolve(process.cwd(), "lib/invoice-allocation.ts"),
      "utf8"
    );
    expect(source).not.toContain("invoicePaymentChangeLog");
    expect(source).not.toContain("invoice-payment-audit");
    expect(source).not.toContain("appendInvoicePaymentChangeLogs");
  });
});
