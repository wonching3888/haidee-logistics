import { describe, expect, it } from "vitest";
import { parseDateInput } from "@/lib/date-utils";
import { resolveCrateStockBucket } from "./inbound-edit-sync";
import type { LocationPoolShipperIds } from "./location-pool-shippers-service";

const OPERATIONAL_ID = "operational-shipper-id";
const AGENT_ID = "agent-shipper-id";
const POOL_IDS: LocationPoolShipperIds = {
  SONGKHLA: "pool-songkhla-id",
  PATTANI: "pool-pattani-id",
};

describe("resolveCrateStockBucket (P1 write routing)", () => {
  it("non-multi returns total ledger when membership map is empty", () => {
    expect(
      resolveCrateStockBucket(
        parseDateInput("2026-06-24"),
        OPERATIONAL_ID,
        "SADAO",
        "SADAO",
        "ABB",
        POOL_IDS,
        new Map(),
        null,
        false
      )
    ).toEqual({
      shipperId: OPERATIONAL_ID,
      location: "",
    });
  });

  it("returns agent shipper with total ledger when member has active membership", () => {
    expect(
      resolveCrateStockBucket(
        parseDateInput("2026-06-24"),
        OPERATIONAL_ID,
        "SADAO",
        "SADAO",
        "WTL",
        POOL_IDS,
        { [OPERATIONAL_ID]: AGENT_ID },
        null,
        false
      )
    ).toEqual({
      shipperId: AGENT_ID,
      location: "",
    });
  });

  it("multi-origin SADAO uses standard origin", () => {
    expect(
      resolveCrateStockBucket(
        parseDateInput("2026-06-24"),
        OPERATIONAL_ID,
        "SADAO",
        "SADAO",
        "remark",
        POOL_IDS,
        new Map(),
        "PHUKET",
        true
      )
    ).toEqual({
      shipperId: OPERATIONAL_ID,
      location: "PHUKET",
    });
  });

  it("keeps Songkhla pool routing when membership exists", () => {
    expect(
      resolveCrateStockBucket(
        parseDateInput("2026-06-24"),
        OPERATIONAL_ID,
        "SONGKHLA",
        "SONGKHLA",
        null,
        POOL_IDS,
        { [OPERATIONAL_ID]: AGENT_ID }
      )
    ).toEqual({
      shipperId: POOL_IDS.SONGKHLA,
      location: "SONGKHLA",
    });
  });
});
