import { describe, expect, it, vi } from "vitest";
import {
  buildInboundDueIndexFromDayInput,
  buildInboundDueIndexFromDueToday,
  lookupInboundDue,
  type InboundDueIndex,
} from "@/lib/crate-export-inbound-due";
import {
  type BuildCrateExportDueTodayInput,
  type CrateExportDueItem,
} from "@/lib/crate-export-due-today";
import {
  crateExportHasSuggestedActualMismatch,
  resolveCrateExportListMismatch,
} from "@/lib/crate-export-list";
import {
  agentParentSyncContextsForMember,
  collectInboundSaveSyncContexts,
  mergeCrateExportSyncContexts,
  syncCrateExportSuggestedForContexts,
} from "@/lib/crate-export-sync-suggested";

const syncHarness = vi.hoisted(() => ({
  todayDate: "2026-07-08",
  dayInputs: new Map<string, BuildCrateExportDueTodayInput>(),
  membershipByMemberId: new Map<string, string>(),
}));

vi.mock("@/lib/crate-export-day-context", async () => {
  return {
    loadCrateExportDayInput: async (dateInput: string) => {
      const input = syncHarness.dayInputs.get(dateInput);
      if (!input) {
        throw new Error(`missing day fixture: ${dateInput}`);
      }
      return input;
    },
    loadLiveOwedIndex: async () => {
      throw new Error("loadLiveOwedIndex should not run from sync no-op");
    },
  };
});

vi.mock("@/lib/crate-stock-agent-membership-service", () => ({
  loadCrateStockAgentMembershipByMemberId: async () =>
    syncHarness.membershipByMemberId,
  loadCrateStockAgentCodeByShipperId: async () => new Map(),
}));

function emptyDayInput(
  overrides: Partial<BuildCrateExportDueTodayInput> = {}
): BuildCrateExportDueTodayInput {
  return {
    date: "2026-07-01",
    poolIds: { SONGKHLA: "pool-sk", PATTANI: "pool-ptn" },
    agents: new Map(),
    membershipByMemberId: new Map(),
    multiOriginByShipperId: new Map(),
    shippers: new Map(),
    subChannelsByKey: new Map(),
    inboundSessions: [],
    exportsByShipperId: new Map(),
    exportsByShipperLocation: new Map(),
    ...overrides,
  };
}

describe("crate-export-inbound-due", () => {
  const items: CrateExportDueItem[] = [
    {
      kind: "row",
      row: {
        key: "s1|N&K",
        label: "Test N&K",
        due: { BRO: 8 },
        returned: { BRO: 8 },
        owed: {},
        totalDue: 8,
        totalReturned: 8,
        totalOwed: 0,
        prefill: {
          mode: "standalone",
          shipperId: "shipper-1",
          shipperCode: "S1",
          shipperName: "Test",
          date: "2026-07-04",
          location: "N&K",
          areaNote: "",
        },
      },
    },
  ];

  it("lookupInboundDue returns inbound due totals by shipper+location", () => {
    const index = buildInboundDueIndexFromDueToday(items);
    expect(
      lookupInboundDue(index, {
        shipperId: "shipper-1",
        location: "N&K",
      })
    ).toEqual({ BRO: 8 });
  });

  it("falls back to standalone when ledger location has no indexed due", () => {
    const index: InboundDueIndex = {
      standalone: new Map([["standalone-1", { WTL: 8 }]]),
      byShipperLocation: new Map(),
      byAgentShipperId: new Map(),
    };
    expect(
      lookupInboundDue(index, {
        shipperId: "standalone-1",
        location: "RANONG",
      })
    ).toEqual({ WTL: 8 });
  });

  it("prefers byShipperLocation over standalone fallback", () => {
    const index: InboundDueIndex = {
      standalone: new Map([["shipper-1", { BRO: 99 }]]),
      byShipperLocation: new Map([["shipper-1|N&K", { BRO: 8 }]]),
      byAgentShipperId: new Map(),
    };
    expect(
      lookupInboundDue(index, { shipperId: "shipper-1", location: "N&K" })
    ).toEqual({ BRO: 8 });
  });

  it("indexes non-multi-origin agent member due for member-level lookup", () => {
    const index = buildInboundDueIndexFromDayInput(
      emptyDayInput({
        agents: new Map([
          [
            "agent-rt",
            { code: "RT", name: "RANONG THONG", isPool: false },
          ],
        ]),
        membershipByMemberId: new Map([["member-aik", "agent-rt"]]),
        shippers: new Map([
          ["member-aik", { code: "AIK", name: "AIK HUAT" }],
        ]),
        inboundSessions: [
          {
            shipperId: "member-aik",
            sessionDate: new Date("2026-07-01T00:00:00.000Z"),
            pickupLocation: null,
            shipperPickupLocation: "RANONG",
            customerOriginLocation: null,
            areaNote: null,
            lines: [{ tongCode: "ABB", quantity: 3, trackInventory: true, isBox: false }],
          },
        ],
      })
    );

    expect(
      lookupInboundDue(index, {
        shipperId: "member-aik",
        location: "RANONG",
      })
    ).toEqual({ ABB: 3 });
    expect(
      lookupInboundDue(index, { shipperId: "member-aik", location: "" })
    ).toEqual({ ABB: 3 });
  });
});

describe("crate-export-list mismatch", () => {
  it("detects suggested vs actual mismatch on any line", () => {
    expect(
      crateExportHasSuggestedActualMismatch([
        { tongCode: "BRO", quantitySuggested: 8, quantityActual: 8 },
      ])
    ).toBe(false);
    expect(
      crateExportHasSuggestedActualMismatch([
        { tongCode: "WTL", quantitySuggested: 8, quantityActual: 0 },
        { tongCode: "BRO", quantitySuggested: 0, quantityActual: 8 },
      ])
    ).toBe(true);
  });

  it("whitelist suppresses list mismatch flag", () => {
    const lines = [
      { tongCode: "VIO", quantitySuggested: 147, quantityActual: 81 },
    ];
    const whitelist = new Set(["thai-tong-id"]);
    expect(
      resolveCrateExportListMismatch(lines, "thai-tong-id", whitelist)
    ).toBe(false);
    expect(
      resolveCrateExportListMismatch(lines, "other-id", whitelist)
    ).toBe(true);
  });
});

describe("crate-export-sync-suggested contexts", () => {
  it("collects before and after shipper/date on inbound edit", () => {
    const contexts = collectInboundSaveSyncContexts({
      before: {
        date: new Date("2026-07-03T00:00:00.000Z"),
        shipperId: "old-shipper",
      },
      after: {
        date: new Date("2026-07-04T00:00:00.000Z"),
        shipperId: "new-shipper",
      },
    });
    expect(contexts).toEqual([
      { dateInput: "2026-07-04", shipperId: "new-shipper" },
      { dateInput: "2026-07-03", shipperId: "old-shipper" },
    ]);
  });

  it("dedupes identical contexts", () => {
    expect(
      mergeCrateExportSyncContexts([
        { dateInput: "2026-07-04", shipperId: "s1" },
        { dateInput: "2026-07-04", shipperId: "s1" },
      ])
    ).toEqual([{ dateInput: "2026-07-04", shipperId: "s1" }]);
  });

  it("member inbound context expands to agent parent", () => {
    const dayInput = emptyDayInput({
      agents: new Map([
        [
          "agent-vk",
          { code: "AGENT-VEERAKORN", name: "VEERAKORN", isPool: false },
        ],
      ]),
      membershipByMemberId: new Map([["member-1", "agent-vk"]]),
    });

    expect(
      agentParentSyncContextsForMember(
        { dateInput: "2026-07-08", shipperId: "member-1" },
        new Map([["member-1", "agent-vk"]]),
        dayInput
      )
    ).toEqual([{ dateInput: "2026-07-08", shipperId: "agent-vk" }]);
  });

  it("pool agent member also expands to pool shipper id", () => {
    const dayInput = emptyDayInput({
      poolIds: { PATTANI: "pool-ptn" },
      agents: new Map([
        [
          "agent-pool",
          {
            code: "LOC-PATTANI",
            name: "PATTANI",
            isPool: true,
            pickup: "PATTANI",
          },
        ],
      ]),
      membershipByMemberId: new Map([["member-jiab", "agent-pool"]]),
    });

    expect(
      agentParentSyncContextsForMember(
        { dateInput: "2026-07-06", shipperId: "member-jiab" },
        new Map([["member-jiab", "agent-pool"]]),
        dayInput
      )
    ).toEqual([
      { dateInput: "2026-07-06", shipperId: "agent-pool" },
      { dateInput: "2026-07-06", shipperId: "pool-ptn" },
    ]);
  });
});

describe("syncCrateExportSuggestedForContexts (snapshot policy)", () => {
  it("does not mutate tong_exports — inbound must not rewrite saved suggested", async () => {
    const update = vi.fn();
    const del = vi.fn();
    const create = vi.fn();
    const findMany = vi.fn();

    const result = await syncCrateExportSuggestedForContexts(
      [{ dateInput: "2026-07-10", shipperId: "shipper-1" }],
      {
        tongExport: { findMany, update, delete: del, create },
      } as never
    );

    expect(result).toEqual({ updatedExportNos: [] });
    expect(findMany).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
