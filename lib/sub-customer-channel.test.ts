import { describe, expect, it } from "vitest";
import {
  resolveSubCustomerChannelStockAccount,
  subCustomerChannelMapKey,
  channelRequiresOriginSelection,
} from "./sub-customer-channel";
import type { SubCustomerChannelRecord } from "./sub-customer-channel";

const PARENT_ID = "parent-ch-id";
const AGENT_ID = "agent-ranong-id";
const POOL_ID = "pool-songkhla-id";

function channel(
  overrides: Partial<SubCustomerChannelRecord> = {}
): SubCustomerChannelRecord {
  return {
    id: "ch-1",
    parentShipperId: PARENT_ID,
    channelKey: "self",
    label: "CH 自己",
    ownerType: "self",
    ownerShipperId: PARENT_ID,
    ownerShipperCode: "3001-C003",
    allowMultiOrigin: true,
    sortOrder: 0,
    ...overrides,
  };
}

describe("subCustomerChannelMapKey", () => {
  it("joins parent and channel key", () => {
    expect(subCustomerChannelMapKey("p1", "ranong")).toBe("p1:ranong");
  });
});

describe("channelRequiresOriginSelection", () => {
  it("requires origin only for self + allowMultiOrigin", () => {
    expect(channelRequiresOriginSelection(channel())).toBe(true);
    expect(
      channelRequiresOriginSelection(
        channel({ ownerType: "agent", ownerShipperId: AGENT_ID })
      )
    ).toBe(false);
  });
});

describe("resolveSubCustomerChannelStockAccount", () => {
  it("self with multi-origin uses parent shipper and origin location", () => {
    expect(
      resolveSubCustomerChannelStockAccount({
        parentShipperId: PARENT_ID,
        channel: channel(),
        customerOriginLocation: "PHUKET",
      })
    ).toEqual({ shipperId: PARENT_ID, location: "PHUKET" });
  });

  it("self without origin uses parent total ledger", () => {
    expect(
      resolveSubCustomerChannelStockAccount({
        parentShipperId: PARENT_ID,
        channel: channel({ allowMultiOrigin: false }),
      })
    ).toEqual({ shipperId: PARENT_ID, location: "" });
  });

  it("agent routes to agent shipper total ledger", () => {
    expect(
      resolveSubCustomerChannelStockAccount({
        parentShipperId: PARENT_ID,
        channel: channel({
          channelKey: "ranong",
          label: "CH RANONG",
          ownerType: "agent",
          ownerShipperId: AGENT_ID,
          ownerShipperCode: "AGENT-RANONG_THONG-2",
          allowMultiOrigin: false,
        }),
      })
    ).toEqual({ shipperId: AGENT_ID, location: "" });
  });

  it("pool routes to pool shipper with location", () => {
    expect(
      resolveSubCustomerChannelStockAccount({
        parentShipperId: PARENT_ID,
        channel: channel({
          channelKey: "songkhla",
          label: "CH SONGKHLA",
          ownerType: "pool",
          ownerShipperId: POOL_ID,
          ownerShipperCode: "LOC-SONGKHLA",
          allowMultiOrigin: false,
        }),
      })
    ).toEqual({ shipperId: POOL_ID, location: "SONGKHLA" });
  });
});
