import { describe, expect, it } from "vitest";
import {
  calculateTripUnloadingFees,
  isKlKpbEligibleStall,
  type UnloadingRateConfigInput,
} from "@/lib/unloading-calculator";

const KL_RATE: UnloadingRateConfigInput = {
  market: "KL",
  smallCrate: 1,
  largeCrate: 2,
  box: 3,
  kpbSmall: 0.5,
  kpbLarge: 1,
  kpbBox: 1.5,
  kpbMode: "per_crate",
  unloadMode: "per_crate",
};

describe("isKlKpbEligibleStall", () => {
  it("accepts A–H + digits", () => {
    expect(isKlKpbEligibleStall("A38")).toBe(true);
    expect(isKlKpbEligibleStall("H41")).toBe(true);
  });

  it("rejects non-pattern stalls", () => {
    expect(isKlKpbEligibleStall("592")).toBe(false);
    expect(isKlKpbEligibleStall("9655")).toBe(false);
    expect(isKlKpbEligibleStall("C43BEN")).toBe(false);
    expect(isKlKpbEligibleStall("L11")).toBe(false);
    expect(isKlKpbEligibleStall(null)).toBe(false);
  });
});

describe("calculateTripUnloadingFees BM/KD KPB disabled", () => {
  const BM_RATE: UnloadingRateConfigInput = {
    market: "BM",
    smallCrate: 1,
    largeCrate: 1,
    box: 0.6,
    kpbSmall: 7,
    kpbLarge: 20,
    kpbBox: 0,
    kpbMode: "per_trip",
    unloadMode: "per_crate",
  };
  const KD_RATE: UnloadingRateConfigInput = {
    market: "KD",
    smallCrate: 1,
    largeCrate: 1,
    box: 1,
    kpbSmall: 5,
    kpbLarge: 10,
    kpbBox: 0,
    kpbMode: "per_trip",
    unloadMode: "per_crate",
  };

  it("BM charges unload only, never KPB (even with non-zero rate config)", () => {
    const [bm] = calculateTripUnloadingFees({
      lines: [
        {
          market: "BM",
          storeCode: null,
          smallCrateQty: 10,
          largeCrateQty: 0,
          boxQty: 0,
        },
      ],
      ratesByMarket: new Map([["BM", BM_RATE]]),
      truckSize: "large",
    });

    expect(bm.unloadFee).toBe(10);
    expect(bm.kpbFee).toBe(0);
    expect(bm.isKpbExempt).toBe(false);
    expect(bm.tripLevelNote).toBeNull();
  });

  it("KD charges unload only, never KPB (even with non-zero rate config)", () => {
    const [kd] = calculateTripUnloadingFees({
      lines: [
        {
          market: "KD",
          storeCode: null,
          smallCrateQty: 8,
          largeCrateQty: 2,
          boxQty: 1,
        },
      ],
      ratesByMarket: new Map([["KD", KD_RATE]]),
      truckSize: "small",
    });

    expect(kd.unloadFee).toBe(11);
    expect(kd.kpbFee).toBe(0);
    expect(kd.isKpbExempt).toBe(false);
    expect(kd.tripLevelNote).toBeNull();
  });
});
describe("calculateTripUnloadingFees KL-group per-stall KPB", () => {
  it("charges KPB only for eligible-stall crate counts", () => {
    const [kl] = calculateTripUnloadingFees({
      lines: [
        {
          market: "KL",
          storeCode: "A38",
          smallCrateQty: 10,
          largeCrateQty: 0,
          boxQty: 0,
          kpbSmallCrateQty: 6,
          kpbLargeCrateQty: 0,
          kpbBoxQty: 0,
        },
      ],
      ratesByMarket: new Map([["KL", KL_RATE]]),
      truckSize: "large",
    });

    expect(kl.unloadFee).toBe(10);
    expect(kl.kpbFee).toBe(3);
    expect(kl.isKpbExempt).toBe(false);
  });

  it("is exempt when no eligible-stall crates (mixed trip aggregated)", () => {
    const [kl] = calculateTripUnloadingFees({
      lines: [
        {
          market: "KL",
          storeCode: "592",
          smallCrateQty: 7,
          largeCrateQty: 0,
          boxQty: 0,
          kpbSmallCrateQty: 0,
          kpbLargeCrateQty: 0,
          kpbBoxQty: 0,
        },
      ],
      ratesByMarket: new Map([["KL", KL_RATE]]),
      truckSize: "large",
    });

    expect(kl.unloadFee).toBe(7);
    expect(kl.kpbFee).toBe(0);
    expect(kl.isKpbExempt).toBe(true);
  });

  it("legacy single-storeCode path when kpb qty fields omitted", () => {
    const [kl] = calculateTripUnloadingFees({
      lines: [
        {
          market: "KL",
          storeCode: "A01",
          smallCrateQty: 4,
          largeCrateQty: 0,
          boxQty: 0,
        },
      ],
      ratesByMarket: new Map([["KL", KL_RATE]]),
      truckSize: "large",
    });

    expect(kl.kpbFee).toBe(2);
    expect(kl.isKpbExempt).toBe(false);
  });
});
