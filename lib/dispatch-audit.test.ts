import { describe, expect, it } from "vitest";
import {
  diffCharterLines,
  diffDispatchCargo,
  diffDispatchScalarFields,
  formatMarketsAudit,
  formatStallLabel,
  summarizeDispatchCargoDiff,
} from "@/lib/dispatch-audit";
import { resolveHistoryEntityTypes } from "@/lib/audit-feed";

describe("diffDispatchCargo", () => {
  it("detects added, removed, and qty changed rows", () => {
    const diff = diffDispatchCargo(
      [
        { inboundLineId: "a", stallLabel: "KL/S1", qty: 10 },
        { inboundLineId: "b", stallLabel: "MC/S2", qty: 5 },
      ],
      [
        { inboundLineId: "a", stallLabel: "KL/S1", qty: 12 },
        { inboundLineId: "c", stallLabel: "BM/S3", qty: 3 },
      ]
    );

    expect(diff).toEqual({
      added: [{ stallLabel: "BM/S3", qty: 3 }],
      removed: [{ stallLabel: "MC/S2", qty: 5 }],
      qtyChanged: [{ stallLabel: "KL/S1", from: 10, to: 12 }],
    });
  });

  it("returns null when cargo unchanged", () => {
    const lines = [{ inboundLineId: "a", stallLabel: "KL/S1", qty: 10 }];
    expect(diffDispatchCargo(lines, lines)).toBeNull();
  });
});

describe("summarizeDispatchCargoDiff", () => {
  it("builds readable from/to strings", () => {
    const summary = summarizeDispatchCargoDiff({
      added: [{ stallLabel: "BM/S3", qty: 3 }],
      removed: [],
      qtyChanged: [{ stallLabel: "KL/S1", from: 10, to: 12 }],
    });
    expect(summary?.from).toContain("改量");
    expect(summary?.to).toContain("新增");
  });
});

describe("diffDispatchScalarFields", () => {
  it("detects plate and markets changes", () => {
    const changes = diffDispatchScalarFields(
      { plate: "ABC1234", markets: formatMarketsAudit(["KL", "MC"]) },
      { plate: "XYZ5678", markets: formatMarketsAudit(["KL"]) },
      ["plate", "markets"]
    );
    expect(changes).toHaveLength(2);
    expect(changes[0].field).toBe("plate");
  });
});

describe("diffCharterLines", () => {
  it("detects charter line qty changes", () => {
    const diff = diffCharterLines(
      [{ tongTypeId: "t1", tongTypeCode: "BP", quantity: 10 }],
      [{ tongTypeId: "t1", tongTypeCode: "BP", quantity: 12 }]
    );
    expect(diff).toEqual({
      added: [],
      removed: [],
      qtyChanged: [{ code: "BP", from: 10, to: 12 }],
    });
  });
});

describe("formatStallLabel", () => {
  it("joins market and stall code", () => {
    expect(formatStallLabel({ code: "S1", market: { code: "KL" } })).toBe(
      "KL/S1"
    );
  });
});

describe("resolveHistoryEntityTypes trips tab", () => {
  it("includes dispatch and charter for trips tab", () => {
    expect(resolveHistoryEntityTypes("trips")).toEqual(["dispatch", "charter"]);
  });

  it("includes all domains for default tab", () => {
    expect(resolveHistoryEntityTypes(undefined)).toEqual([
      "inbound",
      "voucher",
      "payroll",
      "dispatch",
      "charter",
      "invoice_payment",
    ]);
  });
});
