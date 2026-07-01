import { describe, expect, it } from "vitest";
import { parseDateInput } from "@/lib/date-utils";
import { resolveCustomerCrateStockAccount } from "./customer-crate-stock-account";
import type { LocationPoolShipperIds } from "./location-pool-shippers-service";

const OPERATIONAL_ID = "operational-shipper-id";
const AGENT_ID = "agent-shipper-id";
const POOL_IDS: LocationPoolShipperIds = {
  SONGKHLA: "pool-songkhla-id",
  PATTANI: "pool-pattani-id",
};

function accountFor(input: {
  operationalShipperId?: string;
  location?: string;
  isMultiOriginCustomer?: boolean;
  customerOriginLocation?: string | null;
  sessionDate?: string;
  sessionPickup?: string | null;
  shipperPickup?: string | null;
  areaNote?: string | null;
  agentMembershipByMemberId?: Record<string, string>;
}) {
  return resolveCustomerCrateStockAccount({
    operationalShipperId: input.operationalShipperId ?? OPERATIONAL_ID,
    location: input.location,
    isMultiOriginCustomer: input.isMultiOriginCustomer,
    customerOriginLocation: input.customerOriginLocation,
    sessionDate: input.sessionDate
      ? parseDateInput(input.sessionDate)
      : undefined,
    sessionPickupLocation: input.sessionPickup ?? null,
    shipperPickupLocation: input.shipperPickup ?? "SADAO",
    areaNote: input.areaNote ?? null,
    poolIds: input.sessionDate ? POOL_IDS : undefined,
    agentMembershipByMemberId: input.agentMembershipByMemberId,
  });
}

describe("resolveCustomerCrateStockAccount", () => {
  it("non-multi-origin export ignores explicit location (total ledger)", () => {
    expect(
      accountFor({
        location: "ABB",
        isMultiOriginCustomer: false,
      })
    ).toEqual({
      shipperId: OPERATIONAL_ID,
      location: "",
    });
  });

  it("multi-origin export uses explicit location", () => {
    expect(
      accountFor({
        location: "PHUKET",
        isMultiOriginCustomer: true,
      })
    ).toEqual({
      shipperId: OPERATIONAL_ID,
      location: "PHUKET",
    });
  });

  it("returns agent shipper when member has active membership (location still total ledger)", () => {
    expect(
      accountFor({
        location: "WTL",
        isMultiOriginCustomer: false,
        agentMembershipByMemberId: {
          [OPERATIONAL_ID]: AGENT_ID,
        },
      })
    ).toEqual({
      shipperId: AGENT_ID,
      location: "",
    });
  });

  it("before cutoff: Songkhla pickup uses operational shipper", () => {
    expect(accountFor({ sessionDate: "2026-06-23", sessionPickup: "SONGKHLA" }))
      .toEqual({
        shipperId: OPERATIONAL_ID,
        location: "SONGKHLA",
      });
  });

  it("before cutoff: Pattani pickup uses operational shipper", () => {
    expect(accountFor({ sessionDate: "2026-06-23", sessionPickup: "PATTANI" }))
      .toEqual({
        shipperId: OPERATIONAL_ID,
        location: "PATTANI",
      });
  });

  it("non-multi SADAO inbound ignores areaNote (total ledger)", () => {
    expect(
      accountFor({
        sessionDate: "2026-06-23",
        sessionPickup: "SADAO",
        areaNote: "Area-A",
        isMultiOriginCustomer: false,
      })
    ).toEqual({
      shipperId: OPERATIONAL_ID,
      location: "",
    });
  });

  it("multi-origin SADAO inbound uses standard origin", () => {
    expect(
      accountFor({
        sessionDate: "2026-06-23",
        sessionPickup: "SADAO",
        isMultiOriginCustomer: true,
        customerOriginLocation: "PHUKET",
        areaNote: "ignored remark",
      })
    ).toEqual({
      shipperId: OPERATIONAL_ID,
      location: "PHUKET",
    });
  });

  it("on cutoff: Songkhla pickup uses LOC-SONGKHLA pool", () => {
    expect(accountFor({ sessionDate: "2026-06-24", sessionPickup: "SONGKHLA" }))
      .toEqual({
        shipperId: POOL_IDS.SONGKHLA,
        location: "SONGKHLA",
      });
  });

  it("after cutoff: Pattani pickup uses LOC-PATTANI pool", () => {
    expect(accountFor({ sessionDate: "2026-06-25", sessionPickup: "PATTANI" }))
      .toEqual({
        shipperId: POOL_IDS.PATTANI,
        location: "PATTANI",
      });
  });

  it("after cutoff: non-multi SADAO inbound still uses total ledger", () => {
    expect(
      accountFor({
        sessionDate: "2026-06-24",
        sessionPickup: "SADAO",
        areaNote: "Depot-1",
        isMultiOriginCustomer: false,
      })
    ).toEqual({
      shipperId: OPERATIONAL_ID,
      location: "",
    });
  });

  it("pool export keeps SONGKHLA location for non-multi pool shipper", () => {
    expect(
      accountFor({
        location: "SONGKHLA",
        isMultiOriginCustomer: false,
      })
    ).toEqual({
      shipperId: OPERATIONAL_ID,
      location: "SONGKHLA",
    });
  });

  it("falls back to shipper default pickup when session pickup is unset", () => {
    expect(
      accountFor({
        sessionDate: "2026-06-24",
        sessionPickup: null,
        shipperPickup: "SONGKHLA",
      })
    ).toEqual({
      shipperId: POOL_IDS.SONGKHLA,
      location: "SONGKHLA",
    });
  });

  it("pool routing takes precedence over agent membership on SK pickup", () => {
    expect(
      accountFor({
        sessionDate: "2026-06-24",
        sessionPickup: "SONGKHLA",
        agentMembershipByMemberId: {
          [OPERATIONAL_ID]: AGENT_ID,
        },
      })
    ).toEqual({
      shipperId: POOL_IDS.SONGKHLA,
      location: "SONGKHLA",
    });
  });

  it("sub-channel overrides agent membership and office pool routing", () => {
    expect(
      resolveCustomerCrateStockAccount({
        operationalShipperId: OPERATIONAL_ID,
        sessionDate: parseDateInput("2026-06-24"),
        sessionPickupLocation: "SONGKHLA",
        shipperPickupLocation: "SONGKHLA",
        poolIds: POOL_IDS,
        agentMembershipByMemberId: { [OPERATIONAL_ID]: AGENT_ID },
        subChannel: {
          id: "sc-1",
          parentShipperId: OPERATIONAL_ID,
          channelKey: "ranong",
          label: "CH RANONG",
          ownerType: "agent",
          ownerShipperId: AGENT_ID,
          ownerShipperCode: "AGENT-RANONG_THONG-2",
          allowMultiOrigin: false,
          sortOrder: 1,
        },
      })
    ).toEqual({
      shipperId: AGENT_ID,
      location: "",
    });
  });
});
