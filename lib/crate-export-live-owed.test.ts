import { describe, expect, it } from "vitest";
import type { CrateExportDueItem } from "@/lib/crate-export-due-today";
import {
  buildLiveOwedIndexFromDueToday,
  liveShortageForLine,
  lookupLiveOwed,
  shouldUseLiveCrateExportOwed,
  totalLiveShortageForLines,
} from "@/lib/crate-export-live-owed";

describe("crate-export-live-owed", () => {
  it("shouldUseLiveCrateExportOwed matches today only", () => {
    expect(shouldUseLiveCrateExportOwed("2026-07-01", "2026-07-01")).toBe(true);
    expect(shouldUseLiveCrateExportOwed("2026-06-30", "2026-07-01")).toBe(false);
  });

  it("lookupLiveOwed resolves standalone, multi-origin, and agent keys", () => {
    const items: CrateExportDueItem[] = [
      {
        kind: "row",
        row: {
          key: "standalone:a",
          label: "Alpha",
          due: { ABB: 10 },
          returned: { ABB: 4 },
          owed: { ABB: 6 },
          totalDue: 10,
          totalReturned: 4,
          totalOwed: 6,
          prefill: {
            mode: "standalone",
            shipperId: "a",
            shipperCode: "A",
            shipperName: "Alpha",
            date: "2026-07-01",
            location: "",
            areaNote: "",
          },
        },
      },
      {
        kind: "row",
        row: {
          key: "multi:kwan:PHUKET",
          label: "KWAN — PHUKET",
          due: { ABB: 2, WTL: 4 },
          returned: { ABB: 2, WTL: 4 },
          owed: {},
          totalDue: 6,
          totalReturned: 6,
          totalOwed: 0,
          prefill: {
            mode: "standalone",
            shipperId: "kwan",
            shipperCode: "K",
            shipperName: "KWAN",
            date: "2026-07-01",
            location: "PHUKET",
            areaNote: "",
          },
        },
      },
      {
        kind: "agent",
        group: {
          kind: "agent",
          key: "agent:421",
          agentId: "agent-421",
          agentCode: "AGENT-421",
          agentName: "421",
          due: { ABB: 20 },
          returned: { ABB: 6 },
          owed: { ABB: 14 },
          totalDue: 20,
          totalReturned: 6,
          totalOwed: 14,
          prefill: {
            mode: "agent",
            shipperId: "agent-421",
            shipperCode: "AGENT-421",
            shipperName: "421",
            date: "2026-07-01",
            location: "",
            areaNote: "",
            agentId: "agent-421",
            owedByCode: { ABB: 14 },
            members: [],
          },
          members: [],
        },
      },
    ];

    const index = buildLiveOwedIndexFromDueToday(items);
    expect(lookupLiveOwed(index, { shipperId: "a", location: "" })).toEqual({
      ABB: 6,
    });
    expect(
      lookupLiveOwed(index, { shipperId: "kwan", location: "PHUKET" })
    ).toEqual({});
    expect(
      lookupLiveOwed(index, {
        shipperId: "agent-421",
        isAgentReceipt: true,
      })
    ).toEqual({ ABB: 14 });
  });

  it("liveShortageForLine uses owed minus actual", () => {
    expect(liveShortageForLine({ ABB: 4 }, "ABB", 2)).toBe(2);
    expect(liveShortageForLine({ ABB: 2, WTL: 4 }, "ABB", 2)).toBe(0);
    expect(
      totalLiveShortageForLines(
        { ABB: 2, WTL: 4 },
        [
          { tongCode: "ABB", quantityActual: 2 },
          { tongCode: "WTL", quantityActual: 4 },
        ]
      )
    ).toBe(0);
  });
});
