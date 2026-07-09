import { describe, expect, it } from "vitest";
import {
  aggregateLedgerExportReturnsByShipperLocation,
  type CrateExportLedgerReturnRow,
} from "@/lib/crate-export-ledger-returns";

function row(
  overrides: Partial<CrateExportLedgerReturnRow> & Pick<CrateExportLedgerReturnRow, "quantity">
): CrateExportLedgerReturnRow {
  return {
    changeType: "export",
    shipperId: "shipper-1",
    location: "KRABI",
    crateCode: "ABB",
    ...overrides,
  };
}

describe("aggregateLedgerExportReturnsByShipperLocation", () => {
  it("sums export rows by shipper|location", () => {
    const map = aggregateLedgerExportReturnsByShipperLocation([
      row({ quantity: 11 }),
      row({ quantity: 12, crateCode: "WTL" }),
    ]);
    expect(map.get("shipper-1|KRABI")?.get("ABB")).toBe(11);
    expect(map.get("shipper-1|KRABI")?.get("WTL")).toBe(12);
  });

  it("nets export_void against export (006 void-then-resave pattern)", () => {
    const map = aggregateLedgerExportReturnsByShipperLocation([
      row({ changeType: "export", quantity: 11 }),
      row({ changeType: "export_void", quantity: -11 }),
    ]);
    expect(map.has("shipper-1|KRABI")).toBe(false);
  });

  it("keeps only active export after void and resave on same export no", () => {
    const map = aggregateLedgerExportReturnsByShipperLocation([
      row({ changeType: "export", quantity: 11 }),
      row({ changeType: "export_void", quantity: -11 }),
      row({ changeType: "export", quantity: 23 }),
    ]);
    expect(map.get("shipper-1|KRABI")?.get("ABB")).toBe(23);
  });

  it("isolates different locations", () => {
    const map = aggregateLedgerExportReturnsByShipperLocation([
      row({ location: "KRABI", quantity: 5 }),
      row({ location: "PHUKET", quantity: 7 }),
    ]);
    expect(map.get("shipper-1|KRABI")?.get("ABB")).toBe(5);
    expect(map.get("shipper-1|PHUKET")?.get("ABB")).toBe(7);
  });
});
