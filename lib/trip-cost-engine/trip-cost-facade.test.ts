import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  reloadTripCostEngineConfig,
  getTripCostEngineConfig,
} from "@/lib/trip-cost-engine/config";
import {
  resolveTripAllocatedPool,
  sumTripAllocatedWithoutLoadUnload,
} from "@/lib/trip-cost-engine/trip-cost-facade";
import { effectiveMarketsForTripCost } from "@/lib/mc-dispatch-delivery";
import type { RouteMasterCostRow } from "@/lib/trip-route-cost";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function sumShipperVariableMyr(
  byShipper: Map<string, { fuelMyr: number; maintenanceMyr: number; tollMyr: number }>
) {
  return roundMoney(
    Array.from(byShipper.values()).reduce(
      (sum, row) => sum + row.fuelMyr + row.maintenanceMyr + row.tollMyr,
      0
    )
  );
}

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
    code: "KL",
    markets: ["KL", "BP", "SL"],
    sadooMileageKm: 875,
    tollFee: 80,
    tollFeeClass2: 70,
    tollFeeClass3: 60,
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

describe("trip-cost-facade enforced MC all third-party", () => {
  beforeEach(() => {
    reloadTripCostEngineConfig({
      VOUCHER_COST_MODE: "enforced",
      VEHICLE_ALLOC_MODE: "enforced",
    });
  });

  afterEach(() => {
    reloadTripCostEngineConfig({
      VOUCHER_COST_MODE: "legacy",
      VEHICLE_ALLOC_MODE: "legacy",
    });
  });

  it("trip pool variable matches shipper allocator when MC leg dropped from effectiveMarkets", () => {
    const assigned = [
      { marketCode: "MC", mcDeliveryMode: "third_party" },
      { marketCode: "MC", mcDeliveryMode: "third_party" },
    ];
    const effectiveMarkets = effectiveMarketsForTripCost(["KL", "SL", "MC"], assigned);

    const result = resolveTripAllocatedPool({
      effectiveMarkets,
      routeGroups: ["KL", "MC"],
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
          lineId: "kl",
          shipperId: "s1",
          marketCode: "KL",
          quantity: 50,
        },
        {
          lineId: "mc",
          shipperId: "s2",
          marketCode: "MC",
          quantity: 100,
          excludeFromVehicleAllocation: true,
        },
      ],
    });

    const poolVariable = roundMoney(
      result.pool.fuelMyr + result.pool.maintenanceMyr + result.pool.tollMyr
    );
    const shipperVariable = sumShipperVariableMyr(
      result.lineAllocationsByShipper ?? new Map()
    );

    expect(effectiveMarkets).not.toContain("MC");
    expect(poolVariable).toBe(shipperVariable);
    expect(result.lineAllocationsByShipper?.get("s2")?.fuelMyr).toBe(0);
    expect(sumTripAllocatedWithoutLoadUnload(result.pool)).toBeGreaterThan(0);
  });
});
