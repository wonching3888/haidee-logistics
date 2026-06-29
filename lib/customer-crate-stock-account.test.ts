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
  sessionDate?: string;
  sessionPickup?: string | null;
  shipperPickup?: string | null;
  areaNote?: string | null;
  agentMembershipByMemberId?: Record<string, string>;
}) {
  return resolveCustomerCrateStockAccount({
    operationalShipperId: input.operationalShipperId ?? OPERATIONAL_ID,
    location: input.location,
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
  it("returns operational shipper when there is no agent membership", () => {
    expect(
      accountFor({
        location: "ABB",
      })
    ).toEqual({
      shipperId: OPERATIONAL_ID,
      location: "ABB",
    });
  });

  it("returns agent shipper when member has active membership", () => {
    expect(
      accountFor({
        location: "WTL",
        agentMembershipByMemberId: {
          [OPERATIONAL_ID]: AGENT_ID,
        },
      })
    ).toEqual({
      shipperId: AGENT_ID,
      location: "WTL",
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

  it("before cutoff: SADAO pickup uses operational shipper and areaNote", () => {
    expect(
      accountFor({
        sessionDate: "2026-06-23",
        sessionPickup: "SADAO",
        areaNote: "Area-A",
      })
    ).toEqual({
      shipperId: OPERATIONAL_ID,
      location: "Area-A",
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

  it("after cutoff: SADAO pickup still uses operational shipper and areaNote", () => {
    expect(
      accountFor({
        sessionDate: "2026-06-24",
        sessionPickup: "SADAO",
        areaNote: "Depot-1",
      })
    ).toEqual({
      shipperId: OPERATIONAL_ID,
      location: "Depot-1",
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
});
