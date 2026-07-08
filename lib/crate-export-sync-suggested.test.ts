import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
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
import { SHIPPER_KIND } from "@/lib/constants/shipper-kind";
import { getLiveCrateExportOwedByCode } from "@/app/actions/crateExport";
import {
  agentParentSyncContextsForMember,
  collectInboundSaveSyncContexts,
  mergeCrateExportSyncContexts,
  syncCrateExportSuggestedForContexts,
  type CrateExportSyncContext,
} from "@/lib/crate-export-sync-suggested";

const syncHarness = vi.hoisted(() => ({
  todayDate: "2026-07-08",
  dayInputs: new Map<string, BuildCrateExportDueTodayInput>(),
  membershipByMemberId: new Map<string, string>(),
  shippers: new Map<string, { code: string; shipperKind: string | null }>(),
}));

vi.mock("@/lib/date-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/date-utils")>();
  return {
    ...actual,
    getBangkokTodayDateInput: () => syncHarness.todayDate,
  };
});

vi.mock("@/lib/crate-export-day-context", async () => {
  const due = await import("@/lib/crate-export-due-today");
  const live = await import("@/lib/crate-export-live-owed");
  return {
    loadCrateExportDayInput: async (dateInput: string) => {
      const input = syncHarness.dayInputs.get(dateInput);
      if (!input) {
        throw new Error(`missing day fixture: ${dateInput}`);
      }
      return input;
    },
    loadLiveOwedIndex: async (dateInput: string) => {
      const input = syncHarness.dayInputs.get(dateInput);
      if (!input) {
        throw new Error(`missing day fixture: ${dateInput}`);
      }
      return live.buildLiveOwedIndexFromDueToday(
        due.buildCrateExportDueToday(input).items
      );
    },
  };
});

vi.mock("@/lib/crate-stock-agent-membership-service", () => ({
  loadCrateStockAgentMembershipByMemberId: async () =>
    syncHarness.membershipByMemberId,
  loadCrateStockAgentCodeByShipperId: async () => new Map(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shipper: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        syncHarness.shippers.get(where.id) ?? null
      ),
    },
    customerCrateLedger: { findFirst: vi.fn(async () => null) },
  },
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

type MockExportRow = {
  id: string;
  exportNo: string;
  date: Date;
  shipperId: string;
  tongTypeId: string;
  quantitySuggested: number;
  quantityActual: number;
  shortage: number;
  thVehiclePlate: string;
  areaNote: string | null;
  createdById: string;
  shipper: { code: string; shipperKind: string | null };
  tongType: { id: string; code: string; isBox: boolean; displayOrder?: number };
};

function createMockSyncTx(initialRows: MockExportRow[]) {
  const rows = initialRows.map((row) => ({ ...row }));

  const tx = {
    tongExport: {
      findMany: vi.fn(
        async (args: {
          where: { date: Date; shipperId: string };
        }) =>
          rows.filter(
            (row) =>
              row.date.getTime() === args.where.date.getTime() &&
              row.shipperId === args.where.shipperId
          )
      ),
      update: vi.fn(
        async (args: {
          where: { id: string };
          data: { quantitySuggested: number; shortage: number };
        }) => {
          const row = rows.find((r) => r.id === args.where.id);
          if (!row) throw new Error(`missing export row ${args.where.id}`);
          row.quantitySuggested = args.data.quantitySuggested;
          row.shortage = args.data.shortage;
        }
      ),
      delete: vi.fn(async (args: { where: { id: string } }) => {
        const idx = rows.findIndex((r) => r.id === args.where.id);
        if (idx >= 0) rows.splice(idx, 1);
      }),
      create: vi.fn(
        async (args: {
          data: {
            exportNo: string;
            date: Date;
            shipperId: string;
            tongTypeId: string;
            quantitySuggested: number;
            quantityActual: number;
            shortage: number;
            thVehiclePlate: string;
            areaNote: string | null;
            createdById: string;
          };
        }) => {
          const code =
            args.data.tongTypeId === "tt-abb"
              ? "ABB"
              : args.data.tongTypeId === "tt-wtl"
                ? "WTL"
                : "UNK";
          rows.push({
            id: `created-${rows.length}`,
            exportNo: args.data.exportNo,
            date: args.data.date,
            shipperId: args.data.shipperId,
            tongTypeId: args.data.tongTypeId,
            quantitySuggested: args.data.quantitySuggested,
            quantityActual: args.data.quantityActual,
            shortage: args.data.shortage,
            thVehiclePlate: args.data.thVehiclePlate,
            areaNote: args.data.areaNote,
            createdById: args.data.createdById,
            shipper:
              syncHarness.shippers.get(args.data.shipperId) ?? {
                code: "UNKNOWN",
                shipperKind: null,
              },
            tongType: {
              id: args.data.tongTypeId,
              code,
              isBox: false,
            },
          });
        }
      ),
    },
    tongType: {
      findFirst: vi.fn(
        async (args: { where: { code: string } }) => ({
          id: `tt-${args.where.code.toLowerCase()}`,
        })
      ),
    },
  };

  return { tx: tx as unknown as Prisma.TransactionClient, rows };
}

function veerakornEquivalentDayInput(): BuildCrateExportDueTodayInput {
  return {
    date: syncHarness.todayDate,
    poolIds: { SONGKHLA: "pool-sk", PATTANI: "pool-ptn" },
    agents: new Map([
      [
        "agent-veer",
        { code: "AGENT-VEERAKORN", name: "VEERAKORN", isPool: false },
      ],
    ]),
    membershipByMemberId: new Map([
      ["member-jit", "agent-veer"],
      ["member-soon", "agent-veer"],
    ]),
    multiOriginByShipperId: new Map(),
    shippers: new Map([
      ["parent-ch", { code: "3001-C003", name: "CH FISHERY" }],
      ["parent-ct", { code: "3001-C005", name: "CT - SONGKHLA" }],
      ["member-jit", { code: "3001-0004", name: "JIT RANONG" }],
      ["member-soon", { code: "3001-S004", name: "SOON HENG" }],
      ["member-lita", { code: "3001-0007", name: "LITA" }],
      ["member-nr", { code: "3001-N005", name: "NR FISHERY" }],
    ]),
    subChannelsByKey: new Map([
      [
        "parent-ch:ranong",
        {
          id: "sc-ch",
          parentShipperId: "parent-ch",
          channelKey: "ranong",
          label: "CH RANONG",
          ownerType: "agent" as const,
          ownerShipperId: "agent-veer",
          ownerShipperCode: "AGENT-VEERAKORN",
          allowMultiOrigin: false,
          sortOrder: 1,
        },
      ],
      [
        "parent-ct:RANONG",
        {
          id: "sc-ct",
          parentShipperId: "parent-ct",
          channelKey: "RANONG",
          label: "CT RANONG",
          ownerType: "agent" as const,
          ownerShipperId: "agent-veer",
          ownerShipperCode: "AGENT-VEERAKORN",
          allowMultiOrigin: false,
          sortOrder: 1,
        },
      ],
    ]),
    inboundSessions: [
      {
        shipperId: "parent-ch",
        subChannelKey: "ranong",
        sessionDate: new Date(`${syncHarness.todayDate}T00:00:00.000Z`),
        pickupLocation: "SADAO",
        shipperPickupLocation: "SADAO",
        customerOriginLocation: null,
        areaNote: null,
        lines: [
          { tongCode: "ABB", quantity: 19, trackInventory: true, isBox: false },
        ],
      },
      {
        shipperId: "parent-ct",
        subChannelKey: "RANONG",
        sessionDate: new Date(`${syncHarness.todayDate}T00:00:00.000Z`),
        pickupLocation: "SADAO",
        shipperPickupLocation: "SADAO",
        customerOriginLocation: null,
        areaNote: null,
        lines: [
          { tongCode: "ABB", quantity: 6, trackInventory: true, isBox: false },
        ],
      },
      {
        shipperId: "member-jit",
        sessionDate: new Date(`${syncHarness.todayDate}T00:00:00.000Z`),
        pickupLocation: "SADAO",
        shipperPickupLocation: "SADAO",
        customerOriginLocation: null,
        areaNote: null,
        lines: [
          { tongCode: "ABB", quantity: 5, trackInventory: true, isBox: false },
        ],
      },
      {
        shipperId: "member-soon",
        sessionDate: new Date(`${syncHarness.todayDate}T00:00:00.000Z`),
        pickupLocation: "SADAO",
        shipperPickupLocation: "SADAO",
        customerOriginLocation: null,
        areaNote: null,
        lines: [
          { tongCode: "ABB", quantity: 5, trackInventory: true, isBox: false },
        ],
      },
      {
        shipperId: "member-lita",
        sessionDate: new Date(`${syncHarness.todayDate}T00:00:00.000Z`),
        pickupLocation: "SADAO",
        shipperPickupLocation: "SADAO",
        customerOriginLocation: null,
        areaNote: null,
        lines: [
          { tongCode: "WTL", quantity: 7, trackInventory: true, isBox: false },
        ],
      },
      {
        shipperId: "member-nr",
        sessionDate: new Date(`${syncHarness.todayDate}T00:00:00.000Z`),
        pickupLocation: "SADAO",
        shipperPickupLocation: "SADAO",
        customerOriginLocation: null,
        areaNote: null,
        lines: [
          { tongCode: "WTL", quantity: 3, trackInventory: true, isBox: false },
        ],
      },
    ],
    exportsByShipperId: new Map([
      ["parent-ch", new Map([["ABB", 13]])],
      ["parent-ct", new Map([["ABB", 7]])],
      ["agent-veer", new Map([["ABB", 10]])],
    ]),
    exportsByShipperLocation: new Map(),
  };
}

function simpleAgentDayInput(): BuildCrateExportDueTodayInput {
  return {
    date: syncHarness.todayDate,
    poolIds: { SONGKHLA: "pool-sk", PATTANI: "pool-ptn" },
    agents: new Map([
      ["agent-421", { code: "AGENT-421", name: "421", isPool: false }],
    ]),
    membershipByMemberId: new Map([["member-kwan", "agent-421"]]),
    multiOriginByShipperId: new Map(),
    shippers: new Map([["member-kwan", { code: "3001-K001", name: "KWAN" }]]),
    subChannelsByKey: new Map(),
    inboundSessions: [
      {
        shipperId: "member-kwan",
        sessionDate: new Date(`${syncHarness.todayDate}T00:00:00.000Z`),
        pickupLocation: "SADAO",
        shipperPickupLocation: "SADAO",
        customerOriginLocation: null,
        areaNote: null,
        lines: [
          { tongCode: "ABB", quantity: 20, trackInventory: true, isBox: false },
        ],
      },
    ],
    exportsByShipperId: new Map([
      ["member-kwan", new Map([["ABB", 5]])],
      ["agent-421", new Map([["ABB", 3]])],
    ]),
    exportsByShipperLocation: new Map(),
  };
}

async function assertSyncMatchesEditSaveLiveOwed(input: {
  dayInput: BuildCrateExportDueTodayInput;
  shipperId: string;
  shipper: { code: string; shipperKind: string | null };
  exportRows: MockExportRow[];
  contexts: CrateExportSyncContext[];
}) {
  syncHarness.dayInputs.set(syncHarness.todayDate, input.dayInput);
  syncHarness.shippers.set(input.shipperId, input.shipper);

  const { tx, rows } = createMockSyncTx(input.exportRows);
  await syncCrateExportSuggestedForContexts(input.contexts, tx);

  const editSaveOwed = await getLiveCrateExportOwedByCode(
    syncHarness.todayDate,
    input.shipperId,
    ""
  );

  const codes = new Set<string>([
    ...Object.keys(editSaveOwed),
    ...rows.map((row) => row.tongType.code),
  ]);

  for (const code of Array.from(codes)) {
    const row = rows.find((r) => r.tongType.code === code);
    const expected = editSaveOwed[code] ?? 0;
    const got = row?.quantitySuggested ?? 0;
    expect(
      { code, syncSuggested: got, editSaveLiveOwed: expected },
      `sync vs edit-save mismatch for ${code}`
    ).toEqual({ code, syncSuggested: expected, editSaveLiveOwed: expected });
  }
}

describe("syncCrateExportSuggestedForContexts vs getLiveCrateExportOwedByCode", () => {
  beforeEach(() => {
    syncHarness.dayInputs.clear();
    syncHarness.membershipByMemberId.clear();
    syncHarness.shippers.clear();
  });

  it("writes the same suggested qty as edit-save live owed (VEERAKORN sub-channel equivalent)", async () => {
    const dayInput = veerakornEquivalentDayInput();
    syncHarness.membershipByMemberId.set("member-jit", "agent-veer");
    syncHarness.membershipByMemberId.set("member-soon", "agent-veer");

    const date = new Date(`${syncHarness.todayDate}T00:00:00.000Z`);
    await assertSyncMatchesEditSaveLiveOwed({
      dayInput,
      shipperId: "agent-veer",
      shipper: {
        code: "AGENT-VEERAKORN",
        shipperKind: SHIPPER_KIND.CRATE_STOCK_AGENT,
      },
      exportRows: [
        {
          id: "exp-abb",
          exportNo: "TE-INTEG-001",
          date,
          shipperId: "agent-veer",
          tongTypeId: "tt-abb",
          quantitySuggested: 15,
          quantityActual: 0,
          shortage: 15,
          thVehiclePlate: "80-0001",
          areaNote: null,
          createdById: "user-1",
          shipper: {
            code: "AGENT-VEERAKORN",
            shipperKind: SHIPPER_KIND.CRATE_STOCK_AGENT,
          },
          tongType: { id: "tt-abb", code: "ABB", isBox: false },
        },
        {
          id: "exp-wtl",
          exportNo: "TE-INTEG-001",
          date,
          shipperId: "agent-veer",
          tongTypeId: "tt-wtl",
          quantitySuggested: 10,
          quantityActual: 0,
          shortage: 10,
          thVehiclePlate: "80-0001",
          areaNote: null,
          createdById: "user-1",
          shipper: {
            code: "AGENT-VEERAKORN",
            shipperKind: SHIPPER_KIND.CRATE_STOCK_AGENT,
          },
          tongType: { id: "tt-wtl", code: "WTL", isBox: false },
        },
      ],
      contexts: [{ dateInput: syncHarness.todayDate, shipperId: "agent-veer" }],
    });
  });

  it("writes the same suggested qty as edit-save live owed (simple formal-member agent)", async () => {
    const dayInput = simpleAgentDayInput();
    syncHarness.membershipByMemberId.set("member-kwan", "agent-421");

    const date = new Date(`${syncHarness.todayDate}T00:00:00.000Z`);
    await assertSyncMatchesEditSaveLiveOwed({
      dayInput,
      shipperId: "agent-421",
      shipper: {
        code: "AGENT-421",
        shipperKind: SHIPPER_KIND.CRATE_STOCK_AGENT,
      },
      exportRows: [
        {
          id: "exp-simple",
          exportNo: "TE-INTEG-002",
          date,
          shipperId: "agent-421",
          tongTypeId: "tt-abb",
          quantitySuggested: 99,
          quantityActual: 0,
          shortage: 99,
          thVehiclePlate: "80-0002",
          areaNote: null,
          createdById: "user-1",
          shipper: {
            code: "AGENT-421",
            shipperKind: SHIPPER_KIND.CRATE_STOCK_AGENT,
          },
          tongType: { id: "tt-abb", code: "ABB", isBox: false },
        },
      ],
      contexts: [{ dateInput: syncHarness.todayDate, shipperId: "agent-421" }],
    });
  });
});
