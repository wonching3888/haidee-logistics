import { describe, expect, it } from "vitest";
import {
  getPrimaryRouteGroupForMarkets,
  MARKET_DO_PRINT_ORDER,
  partitionRowsByRouteGroup,
} from "@/lib/market-do-route-groups";

function row(area: string, stall = "S1") {
  return {
    area,
    lorryNo: "ABC1234",
    receiverName: stall,
    stallCode: stall,
    quantities: {},
    qty: 1,
  };
}

describe("partitionRowsByRouteGroup", () => {
  it("merges KL sub-markets into one KL section", () => {
    const sections = partitionRowsByRouteGroup(
      [row("KL"), row("BP"), row("SL")],
      ["KL", "BP", "SL"]
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].routeGroup).toBe("KL");
    expect(sections[0].marketCodes).toEqual(["KL", "BP", "SL"]);
    expect(sections[0].rows).toHaveLength(3);
  });

  it("merges BM group sub-markets into one BM section", () => {
    const sections = partitionRowsByRouteGroup(
      [row("BM"), row("P"), row("TP")],
      ["BM", "P", "TP"]
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].routeGroup).toBe("BM");
    expect(sections[0].marketCodes).toEqual(["BM", "P", "TP"]);
  });

  it("orders sections by MARKET_DO_PRINT_ORDER", () => {
    const sections = partitionRowsByRouteGroup(
      [row("MC"), row("KL"), row("BM"), row("A"), row("KD")],
      ["KL", "MC", "BM", "A", "KD"]
    );

    expect(sections.map((s) => s.routeGroup)).toEqual(["KL", "MC", "BM", "A", "KD"]);
    expect(MARKET_DO_PRINT_ORDER.indexOf("KL")).toBeLessThan(
      MARKET_DO_PRINT_ORDER.indexOf("MC")
    );
  });

  it("omits empty route groups", () => {
    const sections = partitionRowsByRouteGroup([row("KL")], ["KL", "MC", "BM"]);

    expect(sections).toHaveLength(1);
    expect(sections[0].routeGroup).toBe("KL");
  });

  it("keeps JB and OTHER as separate sections", () => {
    const sections = partitionRowsByRouteGroup(
      [row("JB"), row("OTHER")],
      ["JB", "OTHER"]
    );

    expect(sections.map((s) => s.routeGroup)).toEqual(["JB", "OTHER"]);
  });

  it("ignores rows for markets that were not selected", () => {
    const sections = partitionRowsByRouteGroup([row("KL"), row("MC")], ["KL"]);

    expect(sections).toHaveLength(1);
    expect(sections[0].routeGroup).toBe("KL");
    expect(sections[0].rows).toHaveLength(1);
  });

  it("returns no sections when there are no rows", () => {
    expect(partitionRowsByRouteGroup([], ["KL", "MC"])).toEqual([]);
  });

  it("splits dispatch D/O rows into A and BM sections (A+BM+P)", () => {
    const doRow = (area: string) => ({
      area,
      lorryNo: "PKS7679",
      consignor: "Shipper",
      store: "S1",
      quantities: { WTL: 1 },
      qty: 1,
    });

    const sections = partitionRowsByRouteGroup(
      [doRow("A"), doRow("BM"), doRow("P")],
      ["A", "BM", "P"]
    );

    expect(sections.map((s) => s.routeGroup)).toEqual(["BM", "A"]);
    expect(sections.find((s) => s.routeGroup === "A")?.rows).toHaveLength(1);
    expect(sections.find((s) => s.routeGroup === "BM")?.rows).toHaveLength(2);
  });
});

describe("getPrimaryRouteGroupForMarkets", () => {
  it("picks earliest route group on MARKET_DO_PRINT_ORDER", () => {
    expect(getPrimaryRouteGroupForMarkets(["A", "KD"])).toBe("A");
    expect(getPrimaryRouteGroupForMarkets(["P", "TP", "KT", "KD"])).toBe("BM");
    expect(getPrimaryRouteGroupForMarkets(["MC", "KL", "BP"])).toBe("KL");
    expect(getPrimaryRouteGroupForMarkets(["BM", "P", "MC"])).toBe("MC");
  });
});
