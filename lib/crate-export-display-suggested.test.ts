import { describe, expect, it } from "vitest";
import type { BuildCrateExportDueTodayInput } from "@/lib/crate-export-due-today";
import {
  applyDisplaySuggestedToLines,
  excludeExportActualsFromDayInput,
  resolveDisplaySuggestedForExport,
  subtractActualsFromQtyMap,
} from "@/lib/crate-export-display-suggested";
import { crateExportHasSuggestedActualMismatch } from "@/lib/crate-export-list";

function emptyDayInput(
  overrides: Partial<BuildCrateExportDueTodayInput> = {}
): BuildCrateExportDueTodayInput {
  return {
    date: "2026-07-10",
    poolIds: {},
    agents: new Map(),
    membershipByMemberId: new Map(),
    multiOriginByShipperId: new Map([["hl", true]]),
    shippers: new Map([["hl", { code: "3001-H001", name: "HONG LEE" }]]),
    subChannelsByKey: new Map(),
    inboundSessions: [
      {
        shipperId: "hl",
        subChannelKey: null,
        sessionDate: new Date("2026-07-10T00:00:00.000Z"),
        pickupLocation: "SADAO",
        shipperPickupLocation: "SADAO",
        customerOriginLocation: "RANONG",
        areaNote: null,
        lines: [
          {
            tongCode: "ABB",
            quantity: 56,
            trackInventory: true,
            isBox: false,
          },
          {
            tongCode: "WTL",
            quantity: 8,
            trackInventory: true,
            isBox: false,
          },
        ],
      },
    ],
    exportsByShipperId: new Map(),
    exportsByShipperLocation: new Map(),
    ...overrides,
  };
}

describe("crate-export-display-suggested", () => {
  it("subtractActualsFromQtyMap removes self without going negative", () => {
    const map = new Map([
      ["ABB", 56],
      ["WTL", 8],
    ]);
    expect(
      Object.fromEntries(subtractActualsFromQtyMap(map, { ABB: 56 }))
    ).toEqual({ WTL: 8 });
  });

  it("excludes this export actuals so suggested = due − other returns only", () => {
    const dayInput = emptyDayInput({
      exportsByShipperLocation: new Map([
        [
          "hl|RANONG",
          new Map([
            ["ABB", 56], // TE-019 self
            ["WTL", 0],
          ]),
        ],
      ]),
      exportsByShipperId: new Map([
        [
          "hl",
          new Map([
            ["ABB", 56],
            ["WTL", 0],
          ]),
        ],
      ]),
    });

    // Without exclude: remaining ABB=0
    // With exclude of TE-019's 56 ABB: suggested ABB=56, WTL=8
    const suggested = resolveDisplaySuggestedForExport(dayInput, {
      shipperId: "hl",
      shipper: { code: "3001-H001", shipperKind: null },
      location: "RANONG",
      actualsByCode: { ABB: 56 },
    });
    expect(suggested).toEqual({ ABB: 56, WTL: 8 });
  });

  it("two exports on same customer: each excludes only itself", () => {
    const dayInput = emptyDayInput({
      inboundSessions: [
        {
          shipperId: "hl",
          subChannelKey: null,
          sessionDate: new Date("2026-07-10T00:00:00.000Z"),
          pickupLocation: "SADAO",
          shipperPickupLocation: "SADAO",
          customerOriginLocation: "RANONG",
          areaNote: null,
          lines: [
            {
              tongCode: "ABB",
              quantity: 100,
              trackInventory: true,
              isBox: false,
            },
          ],
        },
      ],
      exportsByShipperLocation: new Map([
        ["hl|RANONG", new Map([["ABB", 70]])], // TE-A 40 + TE-B 30
      ]),
      exportsByShipperId: new Map([["hl", new Map([["ABB", 70]])]]),
    });

    const sugA = resolveDisplaySuggestedForExport(dayInput, {
      shipperId: "hl",
      shipper: { code: "3001-H001", shipperKind: null },
      location: "RANONG",
      actualsByCode: { ABB: 40 },
    });
    const sugB = resolveDisplaySuggestedForExport(dayInput, {
      shipperId: "hl",
      shipper: { code: "3001-H001", shipperKind: null },
      location: "RANONG",
      actualsByCode: { ABB: 30 },
    });

    // A: due 100 − B's 30 = 70
    expect(sugA.ABB).toBe(70);
    // B: due 100 − A's 40 = 60
    expect(sugB.ABB).toBe(60);
  });

  it("later dispatch increase raises display suggested without touching actual", () => {
    const before = emptyDayInput({
      inboundSessions: [
        {
          shipperId: "hl",
          subChannelKey: null,
          sessionDate: new Date("2026-07-10T00:00:00.000Z"),
          pickupLocation: "SADAO",
          shipperPickupLocation: "SADAO",
          customerOriginLocation: "RANONG",
          areaNote: null,
          lines: [
            {
              tongCode: "ABB",
              quantity: 17,
              trackInventory: true,
              isBox: false,
            },
          ],
        },
      ],
      exportsByShipperLocation: new Map([
        ["hl|RANONG", new Map([["ABB", 17]])],
      ]),
      exportsByShipperId: new Map([["hl", new Map([["ABB", 17]])]]),
    });

    const afterDispatch = emptyDayInput({
      inboundSessions: [
        {
          shipperId: "hl",
          subChannelKey: null,
          sessionDate: new Date("2026-07-10T00:00:00.000Z"),
          pickupLocation: "SADAO",
          shipperPickupLocation: "SADAO",
          customerOriginLocation: "RANONG",
          areaNote: null,
          lines: [
            {
              tongCode: "ABB",
              quantity: 25,
              trackInventory: true,
              isBox: false,
            },
          ],
        },
      ],
      exportsByShipperLocation: new Map([
        ["hl|RANONG", new Map([["ABB", 17]])],
      ]),
      exportsByShipperId: new Map([["hl", new Map([["ABB", 17]])]]),
    });

    const sugBefore = resolveDisplaySuggestedForExport(before, {
      shipperId: "hl",
      shipper: { code: "3001-H001", shipperKind: null },
      location: "RANONG",
      actualsByCode: { ABB: 17 },
    });
    const sugAfter = resolveDisplaySuggestedForExport(afterDispatch, {
      shipperId: "hl",
      shipper: { code: "3001-H001", shipperKind: null },
      location: "RANONG",
      actualsByCode: { ABB: 17 },
    });

    expect(sugBefore.ABB).toBe(17);
    expect(sugAfter.ABB).toBe(25);

    const lines = applyDisplaySuggestedToLines(
      [{ tongCode: "ABB", quantityActual: 17 }],
      sugAfter
    );
    expect(crateExportHasSuggestedActualMismatch(lines)).toBe(true);
  });

  it("excludeExportActualsFromDayInput does not mutate original maps", () => {
    const original = new Map([["ABB", 56]]);
    const dayInput = emptyDayInput({
      exportsByShipperId: new Map([["hl", original]]),
      exportsByShipperLocation: new Map([["hl|RANONG", new Map([["ABB", 56]])]]),
    });
    excludeExportActualsFromDayInput(dayInput, {
      shipperId: "hl",
      location: "RANONG",
      actualsByCode: { ABB: 56 },
    });
    expect(original.get("ABB")).toBe(56);
  });
});
