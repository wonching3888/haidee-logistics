import { describe, expect, it } from "vitest";
import {
  agentMemberRowKey,
  buildSubChannelAffiliateMemberRow,
  formatSubChannelAffiliateDisplayName,
  groupSubCustomerChannelAffiliatesByOwner,
  mergeAgentMemberRowsWithSubChannelAffiliates,
} from "./sub-customer-channel-affiliates";
import type { CrateStockAgentMemberRow } from "@/app/actions/customer-crate-stock-agent";

const crateTypes = [
  { id: "ct-abb", code: "ABB", name: "ABB" },
  { id: "ct-wtl", code: "WTL", name: "WTL" },
];

const formalMember: CrateStockAgentMemberRow = {
  memberShipperId: "member-1",
  memberShipperCode: "3001-A002",
  memberShipperName: "AIK HUAT",
  quantities: { "ct-abb": 10 },
  locations: [],
};

describe("sub-customer-channel-affiliates", () => {
  it("formats display name with channel label", () => {
    expect(formatSubChannelAffiliateDisplayName("CH FISHERY", "CH RANONG")).toBe(
      "CH FISHERY（经 CH RANONG）"
    );
  });

  it("groups affiliates by owner shipper id", () => {
    const grouped = groupSubCustomerChannelAffiliatesByOwner([
      {
        channelKey: "ranong",
        label: "CH RANONG",
        ownerShipperId: "agent-ranong",
        parentShipper: { id: "ch", code: "3001-C003", name: "CH FISHERY" },
      },
      {
        channelKey: "songkhla",
        label: "CH SONGKHLA",
        ownerShipperId: "pool-sk",
        parentShipper: { id: "ch", code: "3001-C003", name: "CH FISHERY" },
      },
    ]);
    expect(grouped.get("agent-ranong")).toHaveLength(1);
    expect(grouped.get("pool-sk")).toHaveLength(1);
  });

  it("merges formal members before affiliate rows", () => {
    const merged = mergeAgentMemberRowsWithSubChannelAffiliates(
      [formalMember],
      crateTypes,
      [
        {
          channelKey: "ranong",
          label: "CH RANONG",
          ownerShipperId: "agent-ranong",
          parentShipper: { id: "ch", code: "3001-C003", name: "CH FISHERY" },
        },
      ]
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].memberShipperName).toBe("AIK HUAT");
    expect(merged[1].isSubChannelAffiliate).toBe(true);
    expect(merged[1].memberShipperName).toBe("CH FISHERY（经 CH RANONG）");
    expect(merged[1].quantities["ct-abb"]).toBe(0);
  });

  it("builds stable row keys for affiliate vs formal member", () => {
    const affiliate = buildSubChannelAffiliateMemberRow(crateTypes, {
      channelKey: "ranong",
      label: "CH RANONG",
      ownerShipperId: "agent-ranong",
      parentShipper: { id: "ch", code: "3001-C003", name: "CH FISHERY" },
    });
    expect(agentMemberRowKey(formalMember)).toBe("member-1");
    expect(agentMemberRowKey(affiliate)).toBe("sub:ch:ranong");
  });
});
