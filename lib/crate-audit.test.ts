import { describe, expect, it } from "vitest";
import {
  buildCrateFeedChanges,
  buildCrateReturnArrivedAuditLog,
  buildInboundCrateEditAuditLogs,
  crateAuditActionLabel,
  crateAuditDeepLink,
} from "@/lib/crate-audit";
import { resolveHistoryEntityTypes } from "@/lib/audit-feed";

describe("crateAuditActionLabel", () => {
  it("labels known actions", () => {
    expect(crateAuditActionLabel("sadao_stock_adjust")).toBe("SADAO库存调整");
    expect(crateAuditActionLabel("inbound_crate_edit")).toBe("改进货桶型/数量");
  });
});

describe("buildInboundCrateEditAuditLogs", () => {
  it("emits logs only for crate type and quantity fields", () => {
    const logs = buildInboundCrateEditAuditLogs({
      shipperId: "shipper-1",
      shipperName: "KH/AR MEI",
      sessionNo: "IN-20260612-001",
      sessionId: "session-1",
      changeLogs: [
        {
          field: "桶型 Crate Type",
          fromValue: "ABB (ABB)",
          toValue: "WTL (WTL)",
        },
        {
          field: "桶数 Crates",
          fromValue: "4",
          toValue: "4",
        },
        {
          field: "收货人 Receiver",
          fromValue: "A/1",
          toValue: "A/2",
        },
      ],
    });

    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      action: "inbound_crate_edit",
      shipperName: "KH/AR MEI",
      beforeValue: "ABB (ABB)",
      afterValue: "WTL (WTL)",
    });
    expect(logs[1]).toMatchObject({
      beforeValue: "4",
      afterValue: "4",
    });
  });
});

describe("buildCrateReturnArrivedAuditLog", () => {
  it("summarizes plate, market, and crate quantities", () => {
    const log = buildCrateReturnArrivedAuditLog({
      truckPlate: "KFJ1234",
      marketCode: "BM",
      dateStr: "2026-06-30",
      lines: [
        { crateTypeCode: "ABB", quantity: 100 },
        { crateTypeCode: "WTL", quantity: 20 },
      ],
    });

    expect(log).toMatchObject({
      action: "crate_return_arrived",
      summary: "KFJ1234 · BM · ABB×100, WTL×20",
    });
  });
});

describe("buildCrateFeedChanges", () => {
  it("maps before/after values for history display", () => {
    expect(
      buildCrateFeedChanges({
        action: "crate_stock_manual_edit",
        crateType: "WTL",
        beforeValue: "147",
        afterValue: "141",
        summary: "test",
      })
    ).toEqual([
      {
        field: "桶库存直接编辑 · WTL",
        from: "147",
        to: "141",
      },
    ]);
  });
});

describe("crateAuditDeepLink", () => {
  it("links inbound edits to session", () => {
    expect(
      crateAuditDeepLink("inbound_crate_edit", {
        sessionNo: "IN-20260612-001",
      })
    ).toBe("/inbound?sessionNo=IN-20260612-001");
  });

  it("links exports to export page", () => {
    expect(
      crateAuditDeepLink("crate_export", { exportNo: "EX-001" })
    ).toBe("/crate/export?exportNo=EX-001");
  });
});

describe("resolveHistoryEntityTypes", () => {
  it("includes crate entity for crate tab", () => {
    expect(resolveHistoryEntityTypes("crate")).toEqual(["crate"]);
  });
});
