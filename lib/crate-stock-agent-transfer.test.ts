import { describe, expect, it } from "vitest";
import {
  assertOperationalMemberShipper,
  buildCrateStockSnapshots,
  isLegacyPoolAgentCode,
  LEGACY_POOL_AGENT_JOIN_NOTES,
  slugifyAgentShipperCode,
} from "./crate-stock-agent-transfer";
import { SHIPPER_KIND } from "./constants/shipper-kind";
import { LOCATION_POOL_SHIPPER_CODES } from "./constants/location-pool-shippers";

describe("crate-stock-agent-transfer", () => {
  it("identifies legacy pool agent codes", () => {
    expect(isLegacyPoolAgentCode(LOCATION_POOL_SHIPPER_CODES.SONGKHLA)).toBe(
      true
    );
    expect(isLegacyPoolAgentCode("AGENT-FOO")).toBe(false);
  });

  it("builds non-zero stock snapshots only", () => {
    expect(
      buildCrateStockSnapshots([
        { crateTypeId: "abb", location: "ABB", quantity: 50 },
        { crateTypeId: "wtl", location: "WTL", quantity: 0 },
        { crateTypeId: "bhr", location: "", quantity: 30 },
      ])
    ).toEqual([
      { crateTypeId: "abb", location: "ABB", quantity: 50 },
      { crateTypeId: "bhr", location: "", quantity: 30 },
    ]);
  });

  it("rejects logistics partner and existing membership", () => {
    expect(() =>
      assertOperationalMemberShipper({
        shipperKind: SHIPPER_KIND.LOGISTICS_PARTNER,
        code: "FOO",
        active: true,
        crateStockAgentMembership: null,
      })
    ).toThrow(/operational/i);

    expect(() =>
      assertOperationalMemberShipper({
        shipperKind: SHIPPER_KIND.OPERATIONAL,
        code: "FOO",
        active: true,
        crateStockAgentMembership: { agentShipperId: "agent-1" },
      })
    ).toThrow(/already belongs/i);
  });

  it("slugifies agent code suffix", () => {
    expect(slugifyAgentShipperCode("Best Brother")).toBe("BEST_BROTHER");
  });

  it("exports legacy pool join notes constant", () => {
    expect(LEGACY_POOL_AGENT_JOIN_NOTES).toBe("legacy-pool-no-transfer");
  });
});
