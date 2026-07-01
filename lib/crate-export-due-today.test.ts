import { describe, expect, it } from "vitest";
import { parseDateInput } from "@/lib/date-utils";
import {
  buildCrateExportDueToday,
  RETURNABLE_CRATE_TYPE_CODES,
  isAgentCrateExportPrefill,
  isReturnableCrateTypeCode,
  sortCrateExportDueTodayItems,
} from "@/lib/crate-export-due-today";
import type { CrateExportDueItem } from "@/lib/crate-export-due-today";

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
    subChannelsByKey: new Map(),
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
      const prefill = result.items[0].group.prefill;
      expect(isAgentCrateExportPrefill(prefill)).toBe(true);
      if (isAgentCrateExportPrefill(prefill)) {
        expect(prefill.mode).toBe("agent");
        expect(prefill.agentId).toBe("agent-421");
        expect(prefill.shipperId).toBe("agent-421");
        expect(prefill.owedByCode).toEqual({ ABB: 20 });
        expect(prefill.members).toHaveLength(1);
        expect(prefill.members[0].label).toBe("KWAN");
        expect(prefill.members[0].due).toEqual({ ABB: 20 });
      }
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
      const prefill = poolItem.group.prefill;
      expect(isAgentCrateExportPrefill(prefill)).toBe(true);
      if (isAgentCrateExportPrefill(prefill)) {
        expect(prefill.mode).toBe("pool");
        expect(prefill.shipperId).toBe("pool-sk");
        expect(prefill.owedByCode).toEqual({ ABB: 15 });
      }
    }
  });

  it("routes pool member SADAO inbound under pool group only (not standalone)", () => {
    const input = baseInput();
    input.shippers.set("member-ct", { code: "3001-C005", name: "CT - SONGKHLA" });
    input.membershipByMemberId.set("member-ct", "pool-sk");
    input.inboundSessions.push({
      shipperId: "member-ct",
      sessionDate,
      pickupLocation: "SADAO",
      shipperPickupLocation: "SONGKHLA",
      customerOriginLocation: null,
      areaNote: null,
      lines: [{ tongCode: "ABB", quantity: 14, trackInventory: true, isBox: false }],
    });

    const result = buildCrateExportDueToday(input);
    expect(result.items.filter((i) => i.kind === "row")).toHaveLength(0);
    const poolItem = result.items.find((i) => i.kind === "pool");
    expect(poolItem?.kind).toBe("pool");
    if (poolItem?.kind === "pool") {
      expect(poolItem.group.members).toHaveLength(1);
      expect(poolItem.group.members[0].label).toBe("CT - SONGKHLA");
      expect(poolItem.group.members[0].totalDue).toBe(14);
    }
  });

  it("merges pool member rows when SADAO and Songkhla inbound same day", () => {
    const input = baseInput();
    input.shippers.set("member-ct", { code: "3001-C005", name: "CT - SONGKHLA" });
    input.membershipByMemberId.set("member-ct", "pool-sk");
    input.inboundSessions.push(
      {
        shipperId: "member-ct",
        sessionDate,
        pickupLocation: "SADAO",
        shipperPickupLocation: "SONGKHLA",
        customerOriginLocation: null,
        areaNote: null,
        lines: [{ tongCode: "ABB", quantity: 14, trackInventory: true, isBox: false }],
      },
      {
        shipperId: "member-ct",
        sessionDate,
        pickupLocation: null,
        shipperPickupLocation: "SONGKHLA",
        customerOriginLocation: null,
        areaNote: null,
        lines: [{ tongCode: "ABB", quantity: 10, trackInventory: true, isBox: false }],
      }
    );

    const result = buildCrateExportDueToday(input);
    expect(result.items.filter((i) => i.kind === "row")).toHaveLength(0);
    const poolItem = result.items.find((i) => i.kind === "pool");
    expect(poolItem?.kind).toBe("pool");
    if (poolItem?.kind === "pool") {
      expect(poolItem.group.members).toHaveLength(1);
      expect(poolItem.group.members[0].label).toBe("CT - SONGKHLA");
      expect(poolItem.group.members[0].totalDue).toBe(24);
      expect(poolItem.group.totalDue).toBe(24);
    }
  });

  it("returns empty when no inbound sessions for today", () => {
    const input = baseInput();
    const result = buildCrateExportDueToday(input);
    expect(result.items).toHaveLength(0);
  });

  it("only counts returnable crate types in due (mixed inbound)", () => {
    const input = baseInput();
    input.inboundSessions.push({
      shipperId: "shipper-a",
      sessionDate,
      pickupLocation: "SADAO",
      shipperPickupLocation: "SADAO",
      customerOriginLocation: null,
      areaNote: null,
      lines: [
        { tongCode: "ABB", quantity: 20, trackInventory: true, isBox: false },
        { tongCode: "GKS", quantity: 50, trackInventory: true, isBox: false },
        { tongCode: "GLY", quantity: 10, trackInventory: true, isBox: false },
      ],
    });

    const result = buildCrateExportDueToday(input);
    expect(result.items).toHaveLength(1);
    if (result.items[0].kind === "row") {
      expect(result.items[0].row.due).toEqual({ ABB: 20 });
      expect(result.items[0].row.totalDue).toBe(20);
      expect(result.items[0].row.due.GKS).toBeUndefined();
    }
  });

  it("omits customer when inbound is only non-returnable crate types", () => {
    const input = baseInput();
    input.inboundSessions.push({
      shipperId: "shipper-a",
      sessionDate,
      pickupLocation: "SADAO",
      shipperPickupLocation: "SADAO",
      customerOriginLocation: null,
      areaNote: null,
      lines: [
        { tongCode: "GKS", quantity: 100, trackInventory: true, isBox: false },
      ],
    });

    const result = buildCrateExportDueToday(input);
    expect(result.items).toHaveLength(0);
  });

  it("ignores non-returnable types in returned when computing owed", () => {
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
    input.exportsByShipperId.set(
      "shipper-a",
      new Map([
        ["ABB", 5],
        ["GKS", 99],
      ])
    );

    const result = buildCrateExportDueToday(input);
    expect(result.items).toHaveLength(1);
    if (result.items[0].kind === "row") {
      expect(result.items[0].row.totalReturned).toBe(5);
      expect(result.items[0].row.totalOwed).toBe(15);
    }
  });

  it("exports RETURNABLE_CRATE_TYPE_CODES as the six tracked types", () => {
    expect([...RETURNABLE_CRATE_TYPE_CODES]).toEqual([
      "ABB",
      "WTL",
      "BHR",
      "VIO",
      "SHK",
      "BRO",
    ]);
  });

  it("excludes non-returnable types from SADAO shortage overview filter", () => {
    type Row = { tongType: { code: string }; shortage: number };
    const all: Row[] = [
      { tongType: { code: "ABB" }, shortage: 616 },
      { tongType: { code: "GKS" }, shortage: 17 },
      { tongType: { code: "BS" }, shortage: 16 },
      { tongType: { code: "WTL" }, shortage: 129 },
    ];
    const filtered = all.filter((r) =>
      isReturnableCrateTypeCode(r.tongType.code)
    );
    expect(filtered.map((r) => r.tongType.code)).toEqual(["ABB", "WTL"]);
    expect(filtered.reduce((s, r) => s + r.shortage, 0)).toBe(745);
  });

  it("pins pool and agent groups before standalone customer rows", () => {
    const items: CrateExportDueItem[] = [
      {
        kind: "row",
        row: {
          key: "standalone:a",
          label: "Alpha Customer",
          due: { ABB: 5 },
          returned: {},
          owed: { ABB: 5 },
          totalDue: 5,
          totalReturned: 0,
          totalOwed: 5,
          prefill: {
            mode: "standalone",
            shipperId: "a",
            shipperCode: "X",
            shipperName: "Alpha",
            date: "2026-06-30",
            location: "",
            areaNote: "",
          },
        },
      },
      {
        kind: "agent",
        group: {
          kind: "agent",
          key: "agent:421",
          agentId: "421",
          agentCode: "AGENT-421",
          agentName: "421",
          due: { ABB: 10 },
          returned: {},
          owed: { ABB: 10 },
          totalDue: 10,
          totalReturned: 0,
          totalOwed: 10,
          prefill: {
            mode: "agent",
            shipperId: "421",
            shipperCode: "AGENT-421",
            shipperName: "421",
            date: "2026-06-30",
            location: "",
            areaNote: "",
            agentId: "421",
            owedByCode: { ABB: 10 },
            members: [],
          },
          members: [],
        },
      },
      {
        kind: "pool",
        group: {
          kind: "pool",
          key: "pool:ptn",
          poolShipperId: "pool-ptn",
          poolCode: "LOC-PATTANI",
          poolName: "北大年",
          pickup: "PATTANI",
          due: { WTL: 3 },
          returned: {},
          owed: { WTL: 3 },
          totalDue: 3,
          totalReturned: 0,
          totalOwed: 3,
          prefill: {
            mode: "pool",
            shipperId: "pool-ptn",
            shipperCode: "LOC-PATTANI",
            shipperName: "北大年",
            date: "2026-06-30",
            location: "PATTANI",
            areaNote: "",
            agentId: "pool-ptn",
            owedByCode: { WTL: 3 },
            members: [],
          },
          members: [],
        },
      },
      {
        kind: "pool",
        group: {
          kind: "pool",
          key: "pool:sk",
          poolShipperId: "pool-sk",
          poolCode: "LOC-SONGKHLA",
          poolName: "宋卡",
          pickup: "SONGKHLA",
          due: { ABB: 8 },
          returned: {},
          owed: { ABB: 8 },
          totalDue: 8,
          totalReturned: 0,
          totalOwed: 8,
          prefill: {
            mode: "pool",
            shipperId: "pool-sk",
            shipperCode: "LOC-SONGKHLA",
            shipperName: "宋卡",
            date: "2026-06-30",
            location: "SONGKHLA",
            areaNote: "",
            agentId: "pool-sk",
            owedByCode: { ABB: 8 },
            members: [],
          },
          members: [],
        },
      },
    ];

    const sorted = sortCrateExportDueTodayItems(items);
    expect(sorted.map((i) =>
      i.kind === "row"
        ? i.row.label
        : i.kind === "agent"
          ? i.group.agentName
          : i.group.poolName
    )).toEqual(["宋卡", "北大年", "421", "Alpha Customer"]);
  });

  it("routes parent inbound via sub-channel agent into agent group", () => {
    const input = baseInput();
    input.agents.set("agent-ranong", {
      code: "AGENT-RANONG_THONG-2",
      name: "RANONG THONG",
      isPool: false,
    });
    input.shippers.set("parent-ch", { code: "3001-C003", name: "CH FISHERY" });
    input.subChannelsByKey.set("parent-ch:ranong", {
      id: "sc-1",
      parentShipperId: "parent-ch",
      channelKey: "ranong",
      label: "CH RANONG",
      ownerType: "agent",
      ownerShipperId: "agent-ranong",
      ownerShipperCode: "AGENT-RANONG_THONG-2",
      allowMultiOrigin: false,
      sortOrder: 1,
    });
    input.inboundSessions.push({
      shipperId: "parent-ch",
      subChannelKey: "ranong",
      sessionDate,
      pickupLocation: "SADAO",
      shipperPickupLocation: "SADAO",
      customerOriginLocation: null,
      areaNote: null,
      lines: [{ tongCode: "ABB", quantity: 12, trackInventory: true, isBox: false }],
    });

    const result = buildCrateExportDueToday(input);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].kind).toBe("agent");
    if (result.items[0].kind === "agent") {
      expect(result.items[0].group.agentCode).toBe("AGENT-RANONG_THONG-2");
      expect(result.items[0].group.members).toHaveLength(1);
      expect(result.items[0].group.members[0].label).toBe(
        "CH FISHERY — CH RANONG"
      );
    }
  });
});
