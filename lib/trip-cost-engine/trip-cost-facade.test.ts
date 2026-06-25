import { describe, expect, it, beforeEach } from "vitest";
import {
  reloadTripCostEngineConfig,
  getTripCostEngineConfig,
} from "@/lib/trip-cost-engine/config";
import {
  resolveTripAllocatedPool,
  sumTripAllocatedWithoutLoadUnload,
} from "@/lib/trip-cost-engine/trip-cost-facade";
import type { RouteMasterCostRow } from "@/lib/trip-route-cost";

const ROUTES: RouteMasterCostRow[] = [
  {
    code: "BM",
    markets: ["BM"],
    sadooMileageKm: 350,
    tollFee: 40,
    tollFeeClass2: 35,
    tollFeeClass3: 30,
    fishCheckingFee: 5,
    parkingFee: 8,
  },
  {
    code: "MC",
    markets: ["MC"],
    sadooMileageKm: 1300,
    tollFee: 120,
    tollFeeClass2: 100,
    tollFeeClass3: 90,
    fishCheckingFee: 6,
    parkingFee: 10,
  },
];

const GLOBAL = {
  borderPass: 25,
  epermit: 12,
  dagangNet: 8,
  forwardingOutbound: 15,
  fuelPriceMyr: 2.5,
};

const TRUCK = {
  fuelEfficiencyKmPerL: 5,
  annualMileageKm: 120_000,
  costItems: [{ annualAmount: 24_000 }],
};

describe("trip-cost-facade legacy wiring", () => {
  beforeEach(() => {
    reloadTripCostEngineConfig({
      VOUCHER_COST_MODE: "legacy",
      VEHICLE_ALLOC_MODE: "legacy",
    });
  });

  it("defaults to legacy flags", () => {
    const cfg = getTripCostEngineConfig();
    expect(cfg.voucherCostMode).toBe("legacy");
    expect(cfg.vehicleAllocMode).toBe("legacy");
  });

  it("legacy pool matches BM+MC baseline shape", () => {
    const result = resolveTripAllocatedPool({
      effectiveMarkets: ["BM", "MC"],
      routeGroups: ["BM", "MC"],
      routes: ROUTES,
      globalCosts: GLOBAL,
      tollClass: "class2",
      truck: TRUCK,
      voucher: null,
      unloadingRows: [],
      loadingRows: [],
      dispatchEstimate: { truck: { type: null }, lines: [] },
      ratesByMarket: new Map(),
      driverMyr: 180,
      costLines: [],
    });

    expect(result.routeCosts.tripMileageKm).toBe(1300);
    expect(sumTripAllocatedWithoutLoadUnload(result.pool)).toBeGreaterThan(0);
    expect(result.lineAllocationsByShipper).toBeUndefined();
  });

  it("enforced branch exists but is not default", () => {
    reloadTripCostEngineConfig({
      VOUCHER_COST_MODE: "enforced",
      VEHICLE_ALLOC_MODE: "enforced",
    });
    const cfg = getTripCostEngineConfig();
    expect(cfg.voucherCostMode).toBe("enforced");
    expect(cfg.vehicleAllocMode).toBe("enforced");

    const result = resolveTripAllocatedPool({
      effectiveMarkets: ["BM", "MC"],
      routeGroups: ["BM", "MC"],
      routes: ROUTES,
      globalCosts: GLOBAL,
      tollClass: "class2",
      truck: TRUCK,
      voucher: null,
      unloadingRows: [],
      loadingRows: [],
      dispatchEstimate: { truck: { type: null }, lines: [] },
      ratesByMarket: new Map(),
      driverMyr: 180,
      costLines: [
        {
          lineId: "l1",
          shipperId: "s1",
          marketCode: "BM",
          quantity: 50,
        },
        {
          lineId: "l2",
          shipperId: "s2",
          marketCode: "MC",
          quantity: 100,
        },
      ],
    });

    expect(result.lineAllocationsByShipper?.size).toBe(2);
    reloadTripCostEngineConfig({
      VOUCHER_COST_MODE: "legacy",
      VEHICLE_ALLOC_MODE: "legacy",
    });
  });
});
