import { describe, expect, it } from "vitest";
import { parseDateInput } from "@/lib/date-utils";
import {
  INBOUND_OFFICE_POOL_CUTOFF_DATE,
  resolveInboundCrateStockAccount,
  usesOfficePoolInboundStock,
} from "./inbound-crate-stock-account";
import type { LocationPoolShipperIds } from "./location-pool-shippers-service";

const OPERATIONAL_ID = "operational-shipper-id";
const POOL_IDS: LocationPoolShipperIds = {
  SONGKHLA: "pool-songkhla-id",
  PATTANI: "pool-pattani-id",
};

function accountFor(input: {
  sessionDate: string;
  sessionPickup?: string | null;
  shipperPickup?: string | null;
  areaNote?: string | null;
}) {
  return resolveInboundCrateStockAccount({
    sessionDate: parseDateInput(input.sessionDate),
    operationalShipperId: OPERATIONAL_ID,
    sessionPickupLocation: input.sessionPickup ?? null,
    shipperPickupLocation: input.shipperPickup ?? "SADAO",
    areaNote: input.areaNote ?? null,
    poolIds: POOL_IDS,
  });
}

describe("usesOfficePoolInboundStock", () => {
  it("is false before cutoff and true on/after cutoff", () => {
    expect(usesOfficePoolInboundStock(parseDateInput("2026-06-23"))).toBe(false);
    expect(usesOfficePoolInboundStock(INBOUND_OFFICE_POOL_CUTOFF_DATE)).toBe(
      true
    );
    expect(usesOfficePoolInboundStock(parseDateInput("2026-06-25"))).toBe(true);
  });
});

describe("resolveInboundCrateStockAccount", () => {
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
});
