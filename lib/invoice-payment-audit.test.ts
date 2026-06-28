import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveHistoryEntityTypes } from "@/lib/audit-feed";
import {
  diffInvoicePaymentFieldChanges,
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
