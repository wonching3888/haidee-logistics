import { describe, expect, it } from "vitest";
import { buildCustomerCrateStockLedgerNotes } from "./customer-crate-stock-ledger-notes";

describe("buildCustomerCrateStockLedgerNotes", () => {
  it("returns base note only when stock account is operational shipper", () => {
    expect(
      buildCustomerCrateStockLedgerNotes({
        baseNote: "归还 TE-001",
        operationalShipperId: "op-1",
        operationalShipperName: "Customer A",
        stockAccountShipperId: "op-1",
      })
    ).toBe("归还 TE-001");
  });

  it("appends via= when stock posts to agent", () => {
    expect(
      buildCustomerCrateStockLedgerNotes({
        baseNote: "归还 TE-001",
        operationalShipperId: "op-1",
        operationalShipperName: "Customer A",
        stockAccountShipperId: "agent-1",
      })
    ).toBe("归还 TE-001 via=Customer A");
  });

  it("returns via only when there is no base note", () => {
    expect(
      buildCustomerCrateStockLedgerNotes({
        operationalShipperId: "op-1",
        operationalShipperName: "Customer A",
        stockAccountShipperId: "agent-1",
      })
    ).toBe("via=Customer A");
  });
});
