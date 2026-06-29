import { describe, expect, it } from "vitest";
import {
  filterPickupSummariesDedupedByAgents,
  sortAgentsForCustomerStockList,
} from "./customer-crate-stock-list";
import type { PickupLocationStockSummary } from "@/app/actions/customerCrateStock";
import type { CrateStockAgentRow } from "@/app/actions/customer-crate-stock-agent";

function summary(
  location: "SONGKHLA" | "PATTANI"
): PickupLocationStockSummary {
  return {
    location,
    title: location,
    shipperId: `id-${location}`,
    shipperName: location,
    quantities: {},
  };
}

function agent(
  code: string,
  isLegacyPool: boolean,
  name: string
): CrateStockAgentRow {
  return {
    shipperId: `id-${code}`,
    shipperCode: code,
    shipperName: name,
    isLegacyPool,
    quantities: {},
    locations: [],
    members: [],
  };
}

describe("filterPickupSummariesDedupedByAgents", () => {
  it("removes Songkhla/Pattani summaries when legacy pool agents exist", () => {
    const agents = [
      agent("LOC-SONGKHLA", true, "宋卡"),
      agent("LOC-PATTANI", true, "北大年"),
    ];
    const filtered = filterPickupSummariesDedupedByAgents(
      [summary("SONGKHLA"), summary("PATTANI")],
      agents
    );
    expect(filtered).toHaveLength(0);
  });

  it("keeps summaries when no matching legacy agent", () => {
    const filtered = filterPickupSummariesDedupedByAgents(
      [summary("SONGKHLA")],
      [agent("AGENT-FOO", false, "Other")]
    );
    expect(filtered).toHaveLength(1);
  });
});

describe("sortAgentsForCustomerStockList", () => {
  it("orders legacy pools before other agents", () => {
    const sorted = sortAgentsForCustomerStockList([
      agent("AGENT-X", false, "Zeta Agent"),
      agent("LOC-PATTANI", true, "北大年"),
      agent("LOC-SONGKHLA", true, "宋卡"),
    ]);
    expect(sorted.map((a) => a.shipperCode)).toEqual([
      "LOC-SONGKHLA",
      "LOC-PATTANI",
      "AGENT-X",
    ]);
  });
});
