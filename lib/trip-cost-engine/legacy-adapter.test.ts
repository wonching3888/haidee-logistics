import { describe, expect, it } from "vitest";
import type { RouteMasterCostRow } from "@/lib/trip-route-cost";
import {
  computeTripRouteCosts,
  computeTripTruckCosts,
  findApplicableRoutes,
} from "@/lib/trip-route-cost";
import {
  legacyAllocateShare,
  legacyAllocateTripVehicleCosts,
  legacyBuildTripAllocatedPool,
  legacyResolveTripRouteCosts,
  legacyResolveTripVehiclePool,
} from "@/lib/trip-cost-engine/legacy-adapter";

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Inline copy of lib/pnl-report.ts allocateShare for regression reference. */
function pnlAllocateShare(part: number, total: number, amount: number) {
  if (total <= 0 || amount <= 0 || part <= 0) return 0;
  return roundMoney((part / total) * amount);
}

const BM_MC_ROUTES: RouteMasterCostRow[] = [
  {
    code: "BM",
    markets: ["BM", "P", "TP"],
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

const GLOBAL_COSTS = {
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

describe("legacyAllocateShare", () => {
  it("matches pnl-report allocateShare formula", () => {
    const cases = [
      { part: 100, total: 150, amount: 325 },
      { part: 50, total: 150, amount: 325 },
      { part: 0, total: 150, amount: 325 },
      { part: 10, total: 0, amount: 100 },
    ];
    for (const c of cases) {
      expect(legacyAllocateShare(c.part, c.total, c.amount)).toBe(
        pnlAllocateShare(c.part, c.total, c.amount)
      );
    }
  });
});

describe("legacyResolveTripRouteCosts", () => {
  it("matches operations-cost computeTripRouteCosts for BM+MC", () => {
    const markets = ["BM", "MC"];
    const applicable = findApplicableRoutes(markets, BM_MC_ROUTES);
    const expected = computeTripRouteCosts(applicable, GLOBAL_COSTS, "class2");
    const actual = legacyResolveTripRouteCosts(
      markets,
      BM_MC_ROUTES,
      GLOBAL_COSTS,
      "class2"
    );
    expect(actual).toEqual(expected);
    expect(actual.tripMileageKm).toBe(1300);
    expect(actual.tollFee).toBe(100);
    expect(actual.fishCheckingFee).toBe(11);
    expect(actual.parkingFee).toBe(18);
  });
});

describe("legacy BM+MC trip vehicle baseline lock", () => {
  const markets = ["BM", "MC"];
  const bmQty = 100;
  const mcQty = 50;
  const totalQty = bmQty + mcQty;
  const driverMyr = 180;

  it("vehicle pool matches operations-cost route + truck helpers", () => {
    const adapterPool = legacyResolveTripVehiclePool({
      dispatchMarkets: markets,
      routes: BM_MC_ROUTES,
      globalCosts: GLOBAL_COSTS,
      tollClass: "class2",
      truck: TRUCK,
    });

    const applicable = findApplicableRoutes(markets, BM_MC_ROUTES);
    const routeCosts = computeTripRouteCosts(
      applicable,
      GLOBAL_COSTS,
      "class2"
    );
    const truckCosts = computeTripTruckCosts(
      routeCosts.tripMileageKm,
      TRUCK,
      GLOBAL_COSTS.fuelPriceMyr
    );

    expect(adapterPool.routeCosts).toEqual(routeCosts);
    expect(adapterPool.fuelMyr).toBe(truckCosts.fuelMyr);
    expect(adapterPool.maintenanceMyr).toBe(truckCosts.maintenanceMyr);
    expect(adapterPool.tripMileageKm).toBe(1300);
  });

  it("shipper allocations match pnl-report-style allocateShare on full trip pool", () => {
    const vehiclePool = legacyResolveTripVehiclePool({
      dispatchMarkets: markets,
      routes: BM_MC_ROUTES,
      globalCosts: GLOBAL_COSTS,
      tollClass: "class2",
      truck: TRUCK,
    });

    const tripAllocated = legacyBuildTripAllocatedPool({
      vehiclePool,
      borderPassMyr: GLOBAL_COSTS.borderPass,
      fishCheckingMyr: vehiclePool.routeCosts.fishCheckingFee,
      parkingMyr: vehiclePool.routeCosts.parkingFee,
      driverMyr,
    });

    const bmAdapter = legacyAllocateTripVehicleCosts({
      quantity: bmQty,
      vehicleAllocationDenominator: totalQty,
      tripAllocated,
    });
    const mcAdapter = legacyAllocateTripVehicleCosts({
      quantity: mcQty,
      vehicleAllocationDenominator: totalQty,
      tripAllocated,
    });

    const referenceKeys = [
      "fuelMyr",
      "maintenanceMyr",
      "tollMyr",
      "borderPassMyr",
      "fishCheckingMyr",
      "parkingMyr",
      "epermitMyr",
      "dagangNetMyr",
      "forwardingMyr",
      "driverMyr",
    ] as const;

    const bmReference = Object.fromEntries(
      referenceKeys.map((key) => [
        key,
        pnlAllocateShare(bmQty, totalQty, tripAllocated[key]),
      ])
    ) as Record<(typeof referenceKeys)[number], number>;

    const mcReference = Object.fromEntries(
      referenceKeys.map((key) => [
        key,
        pnlAllocateShare(mcQty, totalQty, tripAllocated[key]),
      ])
    ) as Record<(typeof referenceKeys)[number], number>;

    for (const key of referenceKeys) {
      expect(bmAdapter[key]).toBe(bmReference[key]);
      expect(mcAdapter[key]).toBe(mcReference[key]);
    }

    const bmRefTotal = roundMoney(
      referenceKeys.reduce((sum, key) => sum + bmReference[key], 0)
    );
    const mcRefTotal = roundMoney(
      referenceKeys.reduce((sum, key) => sum + mcReference[key], 0)
    );

    expect(bmAdapter.allocatedCostMyr).toBe(bmRefTotal);
    expect(mcAdapter.allocatedCostMyr).toBe(mcRefTotal);

    const tripPoolTotal = roundMoney(
      referenceKeys.reduce((sum, key) => sum + tripAllocated[key], 0)
    );
    expect(roundMoney(bmAdapter.allocatedCostMyr + mcAdapter.allocatedCostMyr)).toBe(
      tripPoolTotal
    );

    expect(bmAdapter.allocatedCostMyr).toBeGreaterThan(0);
    expect(mcAdapter.allocatedCostMyr).toBeGreaterThan(0);
    // Legacy: larger barrel share → larger vehicle pool share (BM 100 > MC 50).
    expect(bmAdapter.allocatedCostMyr).toBeGreaterThan(mcAdapter.allocatedCostMyr);
  });
});
