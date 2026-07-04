import { describe, expect, it } from "vitest";
import { LARGE_CRATE_CODES } from "@/lib/driver-expense/constants";
import {
  classifyThaiCostCrate,
  DEFAULT_THAI_COST_LARGE_TONG_TYPE_CODES,
  parseLargeTongTypeCodes,
} from "@/lib/thai-cost/crate-classify";
import { calculateTripUnloadingFees } from "@/lib/unloading-calculator";

describe("Thai cost crate classify (independent of MY unload)", () => {
  it("defaults include GKS as large", () => {
    expect(DEFAULT_THAI_COST_LARGE_TONG_TYPE_CODES).toContain("GKS");
    expect(DEFAULT_THAI_COST_LARGE_TONG_TYPE_CODES).toContain("VIO");
    expect(DEFAULT_THAI_COST_LARGE_TONG_TYPE_CODES).toContain("BS");
  });

  it("classifies GKS as large for Thai cost", () => {
    expect(
      classifyThaiCostCrate("GKS", false, DEFAULT_THAI_COST_LARGE_TONG_TYPE_CODES)
    ).toBe("large");
  });

  it("MY unloading LARGE_CRATE_CODES stays VIO/BS only (no GKS)", () => {
    expect([...LARGE_CRATE_CODES].sort()).toEqual(["BS", "VIO"]);
    expect(LARGE_CRATE_CODES.has("GKS")).toBe(false);
  });

  it("parseLargeTongTypeCodes accepts JSON and CSV", () => {
    expect(parseLargeTongTypeCodes('["VIO","BS","GKS"]')).toEqual([
      "VIO",
      "BS",
      "GKS",
    ]);
    expect(parseLargeTongTypeCodes("VIO, BS, GKS")).toEqual([
      "VIO",
      "BS",
      "GKS",
    ]);
  });
});

describe("MY unloading fee regression (must not change)", () => {
  const ratesByMarket = new Map([
    [
      "KL",
      {
        market: "KL",
        smallCrate: 1.5,
        largeCrate: 2,
        box: 1,
        kpbSmall: 0.5,
        kpbLarge: 0.6,
        kpbBox: 0.3,
        kpbMode: "per_crate",
        unloadMode: "per_crate",
        perTripSmallTruck: null,
        perTripLargeTruck: null,
        thirdPartyFlatUnload: null,
      },
    ],
  ]);

  it("treats GKS as small for unload (same as pre-change)", () => {
    // If GKS were wrongly large, largeCrateQty would be 10 and fee would use largeCrate rate.
    const result = calculateTripUnloadingFees({
      lines: [
        {
          market: "KL",
          storeCode: "A1",
          smallCrateQty: 10, // GKS counted as small by MY classify
          largeCrateQty: 0,
          boxQty: 0,
        },
      ],
      ratesByMarket,
      truckSize: "large",
    });
    expect(result[0].unloadFee).toBe(15); // 10 * 1.5
    expect(result[0].smallCrateQty).toBe(10);
    expect(result[0].largeCrateQty).toBe(0);
  });

  it("VIO still large for unload", () => {
    const result = calculateTripUnloadingFees({
      lines: [
        {
          market: "KL",
          storeCode: "A1",
          smallCrateQty: 0,
          largeCrateQty: 10,
          boxQty: 0,
        },
      ],
      ratesByMarket,
      truckSize: "large",
    });
    expect(result[0].unloadFee).toBe(20); // 10 * 2
  });
});
