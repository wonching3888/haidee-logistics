import { describe, expect, it } from "vitest";
import { parseDateInput } from "@/lib/date-utils";
import { buildCrateExportDueToday } from "@/lib/crate-export-due-today";

const poolIds = { SONGKHLA: "pool-sk", PATTANI: "pool-ptn" };
const sessionDate = parseDateInput("2026-06-30");

function baseInput() {
  return {
    date: "2026-06-30",
    poolIds,
    agents: new Map([
      ["agent-421", { code: "AGENT-421", name: "421", isPool: false }],
      [
        "pool-sk",
        {
          code: "LOC-SONGKHLA",
          name: "宋卡",
          isPool: true,
          pickup: "SONGKHLA" as const,
        },
      ],
    ]),
    membershipByMemberId: new Map([["member-kwan", "agent-421"]]),
    multiOriginByShipperId: new Map([["shipper-bb", true]]),
    shippers: new Map([
      ["shipper-a", { code: "3001-A001", name: "Customer A" }],
      ["member-kwan", { code: "3001-K001", name: "KWAN" }],
      ["shipper-bb", { code: "3000-B002", name: "BEST BROTHER" }],
    ]),
    inboundSessions: [] as Parameters<typeof buildCrateExportDueToday>[0]["inboundSessions"],
    exportsByShipperId: new Map<string, Map<string, number>>(),
    exportsByShipperLocation: new Map<string, Map<string, number>>(),
  };
}

describe("buildCrateExportDueToday", () => {
  it("shows standalone customer with due minus returned", () => {
    const input = baseInput();
    input.inboundSessions.push({
      shipperId: "shipper-a",
      sessionDate,
      pickupLocation: "SADAO",
      shipperPickupLocation: "SADAO",
      customerOriginLocation: null,
      areaNote: null,
      lines: [{ tongCode: "ABB", quantity: 20, trackInventory: true, isBox: false }],
    });
    input.exportsByShipperId.set("shipper-a", new Map([["ABB", 5]]));

    const result = buildCrateExportDueToday(input);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].kind).toBe("row");
    if (result.items[0].kind === "row") {
      expect(result.items[0].row.totalDue).toBe(20);
      expect(result.items[0].row.totalReturned).toBe(5);
      expect(result.items[0].row.totalOwed).toBe(15);
    }
  });

  it("hides row when fully returned same day", () => {
    const input = baseInput();
    input.inboundSessions.push({
      shipperId: "shipper-a",
      sessionDate,
      pickupLocation: "SADAO",
      shipperPickupLocation: "SADAO",
      customerOriginLocation: null,
      areaNote: null,
      lines: [{ tongCode: "WTL", quantity: 10, trackInventory: true, isBox: false }],
    });
    input.exportsByShipperId.set("shipper-a", new Map([["WTL", 10]]));

    const result = buildCrateExportDueToday(input);
    expect(result.items).toHaveLength(0);
  });

  it("splits multi-origin customer by origin", () => {
    const input = baseInput();
    input.inboundSessions.push(
      {
        shipperId: "shipper-bb",
        sessionDate,
        pickupLocation: "SADAO",
        shipperPickupLocation: "SADAO",
        customerOriginLocation: "KRABI",
        areaNote: null,
        lines: [{ tongCode: "ABB", quantity: 30, trackInventory: true, isBox: false }],
      },
      {
        shipperId: "shipper-bb",
        sessionDate,
        pickupLocation: "SADAO",
        shipperPickupLocation: "SADAO",
        customerOriginLocation: "PHUKET",
        areaNote: null,
        lines: [{ tongCode: "WTL", quantity: 12, trackInventory: true, isBox: false }],
      }
    );

    const result = buildCrateExportDueToday(input);
    expect(result.items).toHaveLength(2);
    const labels = result.items.map((i) =>
      i.kind === "row" ? i.row.label : ""
    );
    expect(labels).toContain("BEST BROTHER — KRABI");
    expect(labels).toContain("BEST BROTHER — PHUKET");
  });

  it("groups agent member with inbound today under agent expand", () => {
    const input = baseInput();
    input.inboundSessions.push({
      shipperId: "member-kwan",
      sessionDate,
      pickupLocation: "SADAO",
      shipperPickupLocation: "SADAO",
      customerOriginLocation: null,
      areaNote: null,
      lines: [{ tongCode: "ABB", quantity: 20, trackInventory: true, isBox: false }],
    });

    const result = buildCrateExportDueToday(input);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].kind).toBe("agent");
    if (result.items[0].kind === "agent") {
      expect(result.items[0].group.agentCode).toBe("AGENT-421");
      expect(result.items[0].group.members).toHaveLength(1);
      expect(result.items[0].group.members[0].label).toBe("KWAN");
      expect(result.items[0].group.members[0].totalDue).toBe(20);
    }
  });

  it("shows pool group with members that had inbound today", () => {
    const input = baseInput();
    input.shippers.set("member-sk", { code: "3001-S001", name: "SK Member" });
    input.membershipByMemberId.set("member-sk", "pool-sk");
    input.inboundSessions.push({
      shipperId: "member-sk",
      sessionDate,
      pickupLocation: "SONGKHLA",
      shipperPickupLocation: "SONGKHLA",
      customerOriginLocation: null,
      areaNote: null,
      lines: [{ tongCode: "ABB", quantity: 15, trackInventory: true, isBox: false }],
    });

    const result = buildCrateExportDueToday(input);
    const poolItem = result.items.find((i) => i.kind === "pool");
    expect(poolItem?.kind).toBe("pool");
    if (poolItem?.kind === "pool") {
      expect(poolItem.group.members).toHaveLength(1);
      expect(poolItem.group.members[0].label).toBe("SK Member");
    }
  });

  it("returns empty when no inbound sessions for today", () => {
    const input = baseInput();
    const result = buildCrateExportDueToday(input);
    expect(result.items).toHaveLength(0);
  });
});
