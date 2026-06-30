import { describe, expect, it } from "vitest";
import {
  canEditCustomerCrateStock,
  canManageCrateStockAgents,
} from "@/lib/customer-crate-stock-permissions";
import {
  canAccessAutocountExport,
  canViewFreightOnEntry,
  canViewInvoiceAmounts,
} from "@/lib/auth-roles";

describe("canEditCustomerCrateStock", () => {
  it("allows admin and clerk (operation)", () => {
    expect(canEditCustomerCrateStock("admin")).toBe(true);
    expect(canEditCustomerCrateStock("clerk")).toBe(true);
  });

  it("denies viewer and accounting roles", () => {
    expect(canEditCustomerCrateStock("viewer")).toBe(false);
    expect(canEditCustomerCrateStock("my_accounting")).toBe(false);
    expect(canEditCustomerCrateStock("thai_accounting")).toBe(false);
    expect(canEditCustomerCrateStock("accounting")).toBe(false);
  });

  it("does not broaden clerk access to freight, invoice, or autocount", () => {
    expect(canViewFreightOnEntry("clerk")).toBe(false);
    expect(canViewInvoiceAmounts("clerk")).toBe(false);
    expect(canAccessAutocountExport("clerk")).toBe(false);
    expect(canEditCustomerCrateStock("clerk")).toBe(true);
    expect(canManageCrateStockAgents("clerk")).toBe(false);
  });
});

describe("canManageCrateStockAgents", () => {
  it("allows admin only", () => {
    expect(canManageCrateStockAgents("admin")).toBe(true);
    expect(canManageCrateStockAgents("clerk")).toBe(false);
    expect(canManageCrateStockAgents("viewer")).toBe(false);
  });
});
