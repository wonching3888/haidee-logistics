import { describe, expect, it } from "vitest";
import type { TripCostLineInput } from "@/lib/trip-cost-engine/types";
import { getRouteGroups } from "@/lib/payroll-route-label";
import { effectiveMarketsForTripCost } from "@/lib/mc-dispatch-delivery";
import {
  assertTripVehicleAllocationConserved,
  allocateTripLineCosts,
} from "@/lib/trip-cost-engine/line-cost-allocator";
import {
  legacyBuildTripAllocatedPool,
  legacyResolveTripRouteCosts,
  legacyResolveTripVehiclePool,
} from "@/lib/trip-cost-engine/legacy-adapter";
import { buildVehicleLegPlan } from "@/lib/trip-cost-engine/vehicle-leg-resolver";
import type { RouteMasterCostRow } from "@/lib/trip-route-cost";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
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

const GLOBAL = {
  borderPass: 25,
  epermit: 12,
  dagangNet: 8,
  forwardingOutbound: 15,
  fuelPriceMyr: 2.5,
};

/** Maintenance zero → fuel-only 0.5 MYR/km (doc §2.2 illustrative rate). */
const DOC_TRUCK = {
  fuelEfficiencyKmPerL: 5,
  annualMileageKm: 120_000,
  costItems: [{ annualAmount: 0 }],
};

const PROD_TRUCK = {
  fuelEfficiencyKmPerL: 5,
  annualMileageKm: 120_000,
  costItems: [{ annualAmount: 24_000 }],
};

function bmMcLines(bmQty: number, mcQty: number): TripCostLineInput[] {
  return [
    {
      lineId: "bm-line",
      shipperId: "shipper-bm",
      marketCode: "BM",
      quantity: bmQty,
    },
    {
      lineId: "mc-line",
      shipperId: "shipper-mc",
      marketCode: "MC",
      quantity: mcQty,
    },
  ];
}

describe("allocateTripLineCosts BM+MC", () => {
  const bmQty = 50;
  const mcQty = 100;

  it("★ doc §2.2 variable leg split: BM≈58.33, MC≈591.67 (fuel 0.5/km, no maintenance)", () => {
    const plan = buildVehicleLegPlan({
      routeGroups: getRouteGroups(["BM", "MC"]),
      routes: BM_MC_ROUTES,
      tollClass: "class2",
      fuelPriceMyr: GLOBAL.fuelPriceMyr,
      truck: DOC_TRUCK,
    });

    const result = allocateTripLineCosts({
      lines: bmMcLines(bmQty, mcQty),
      legPlan: plan,
      globalFees: {
        borderPassMyr: 0,
        fishCheckingMyr: 0,
        epermitMyr: 0,
        dagangNetMyr: 0,
        forwardingMyr: 0,
        driverMyr: 0,
      },
    });

    const bmRow = result.allocations.find((row) => row.marketCode === "BM");
    const mcRow = result.allocations.find((row) => row.marketCode === "MC");

    const bmFuelMaint = roundMoney((bmRow?.fuelMyr ?? 0) + (bmRow?.maintenanceMyr ?? 0));
    const mcFuelMaint = roundMoney((mcRow?.fuelMyr ?? 0) + (mcRow?.maintenanceMyr ?? 0));

    expect(bmFuelMaint).toBeCloseTo(58.33, 2);
    expect(mcFuelMaint).toBeCloseTo(591.67, 2);
    expect(roundMoney(bmFuelMaint + mcFuelMaint)).toBe(650);
  });

  it("BM only leg1 toll share; MC leg0+leg1 toll (class2 incremental 35+65)", () => {
    const plan = buildVehicleLegPlan({
      routeGroups: getRouteGroups(["BM", "MC"]),
      routes: BM_MC_ROUTES,
      tollClass: "class2",
      fuelPriceMyr: GLOBAL.fuelPriceMyr,
      truck: DOC_TRUCK,
    });

    const result = allocateTripLineCosts({
      lines: bmMcLines(bmQty, mcQty),
      legPlan: plan,
      globalFees: {
        borderPassMyr: 0,
        fishCheckingMyr: 0,
        epermitMyr: 0,
        dagangNetMyr: 0,
        forwardingMyr: 0,
        driverMyr: 0,
      },
    });

    const bmRow = result.allocations.find((row) => row.marketCode === "BM");
    const mcRow = result.allocations.find((row) => row.marketCode === "MC");

    expect(bmRow?.tollMyr).toBeCloseTo(11.67, 2);
    expect(mcRow?.tollMyr).toBeCloseTo(88.33, 2);
    expect(roundMoney((bmRow?.tollMyr ?? 0) + (mcRow?.tollMyr ?? 0))).toBe(100);
  });

  it("★ conserves full trip pool vs legacy (fuel+maintenance+toll+global)", () => {
    const markets = ["BM", "MC"];
    const vehiclePool = legacyResolveTripVehiclePool({
      dispatchMarkets: markets,
      routes: BM_MC_ROUTES,
      globalCosts: GLOBAL,
      tollClass: "class2",
      truck: PROD_TRUCK,
    });
    const routeCosts = legacyResolveTripRouteCosts(
      markets,
      BM_MC_ROUTES,
      GLOBAL,
      "class2"
    );
    const tripAllocated = legacyBuildTripAllocatedPool({
      vehiclePool,
      borderPassMyr: GLOBAL.borderPass,
      fishCheckingMyr: routeCosts.fishCheckingFee,
      parkingMyr: routeCosts.parkingFee,
      driverMyr: 180,
    });

    const plan = buildVehicleLegPlan({
      routeGroups: getRouteGroups(markets),
      routes: BM_MC_ROUTES,
      tollClass: "class2",
      fuelPriceMyr: GLOBAL.fuelPriceMyr,
      truck: PROD_TRUCK,
    });

    const result = allocateTripLineCosts({
      lines: bmMcLines(bmQty, mcQty),
      legPlan: plan,
      globalFees: {
        borderPassMyr: tripAllocated.borderPassMyr,
        fishCheckingMyr: tripAllocated.fishCheckingMyr,
        epermitMyr: tripAllocated.epermitMyr,
        dagangNetMyr: tripAllocated.dagangNetMyr,
        forwardingMyr: tripAllocated.forwardingMyr,
        driverMyr: tripAllocated.driverMyr,
      },
    });

    expect(() =>
      assertTripVehicleAllocationConserved(result, {
        fuelMyr: tripAllocated.fuelMyr,
        maintenanceMyr: tripAllocated.maintenanceMyr,
        tollMyr: tripAllocated.tollMyr,
        borderPassMyr: tripAllocated.borderPassMyr,
        fishCheckingMyr: tripAllocated.fishCheckingMyr,
        epermitMyr: tripAllocated.epermitMyr,
        dagangNetMyr: tripAllocated.dagangNetMyr,
        forwardingMyr: tripAllocated.forwardingMyr,
        driverMyr: tripAllocated.driverMyr,
      })
    ).not.toThrow();

    const bmRow = result.allocations.find((row) => row.marketCode === "BM");
    const mcRow = result.allocations.find((row) => row.marketCode === "MC");
    expect(bmRow!.totalAllocatedMyr).toBeLessThan(mcRow!.totalAllocatedMyr);
  });
});

describe("allocateTripLineCosts MC third-party", () => {
  it("MC line vehicle qty=0; BM absorbs variable + global on allocatable barrels", () => {
    const assigned = [
      { marketCode: "MC", mcDeliveryMode: "third_party" },
      { marketCode: "MC", mcDeliveryMode: "third_party" },
    ];
    const effectiveMarkets = effectiveMarketsForTripCost(["BM", "MC"], assigned);

    const plan = buildVehicleLegPlan({
      routeGroups: getRouteGroups(effectiveMarkets),
      routes: BM_MC_ROUTES,
      tollClass: "class2",
      fuelPriceMyr: GLOBAL.fuelPriceMyr,
      truck: PROD_TRUCK,
    });

    const lines: TripCostLineInput[] = [
      {
        lineId: "bm",
        shipperId: "s1",
        marketCode: "BM",
        quantity: 50,
      },
      {
        lineId: "mc",
        shipperId: "s2",
        marketCode: "MC",
        quantity: 100,
        excludeFromVehicleAllocation: true,
      },
    ];

    const legacyPool = legacyResolveTripVehiclePool({
      dispatchMarkets: effectiveMarkets,
      routes: BM_MC_ROUTES,
      globalCosts: GLOBAL,
      tollClass: "class2",
      truck: PROD_TRUCK,
    });
    const legacyRoute = legacyResolveTripRouteCosts(
      effectiveMarkets,
      BM_MC_ROUTES,
      GLOBAL,
      "class2"
    );

    const result = allocateTripLineCosts({
      lines,
      legPlan: plan,
      globalFees: {
        borderPassMyr: GLOBAL.borderPass,
        fishCheckingMyr: legacyRoute.fishCheckingFee,
        epermitMyr: legacyRoute.epermit,
        dagangNetMyr: legacyRoute.dagangNet,
        forwardingMyr: legacyRoute.forwarding,
        driverMyr: 0,
      },
    });

    const mcRow = result.allocations.find((row) => row.marketCode === "MC");
    const bmRow = result.allocations.find((row) => row.marketCode === "BM");

    expect(mcRow?.fuelMyr).toBe(0);
    expect(mcRow?.tollMyr).toBe(0);
    expect(mcRow?.totalAllocatedMyr).toBe(0);
    expect(bmRow!.totalAllocatedMyr).toBeGreaterThan(0);

    expect(() =>
      assertTripVehicleAllocationConserved(result, {
        fuelMyr: legacyPool.fuelMyr,
        maintenanceMyr: legacyPool.maintenanceMyr,
        tollMyr: legacyRoute.tollFee,
        borderPassMyr: GLOBAL.borderPass,
        fishCheckingMyr: legacyRoute.fishCheckingFee,
        epermitMyr: legacyRoute.epermit,
        dagangNetMyr: legacyRoute.dagangNet,
        forwardingMyr: legacyRoute.forwarding,
        driverMyr: 0,
      })
    ).not.toThrow();
  });
});

describe("allocateTripLineCosts single market", () => {
  it("BM-only trip allocates entire leg pool to BM line", () => {
    const plan = buildVehicleLegPlan({
      routeGroups: getRouteGroups(["BM"]),
      routes: BM_MC_ROUTES,
      tollClass: "class2",
      fuelPriceMyr: GLOBAL.fuelPriceMyr,
      truck: PROD_TRUCK,
    });

    const result = allocateTripLineCosts({
      lines: [
        {
          lineId: "bm",
          shipperId: "s1",
          marketCode: "BM",
          quantity: 80,
        },
      ],
      legPlan: plan,
      globalFees: {
        borderPassMyr: 25,
        fishCheckingMyr: 5,
        epermitMyr: 12,
        dagangNetMyr: 8,
        forwardingMyr: 15,
        driverMyr: 100,
      },
    });

    expect(result.allocations).toHaveLength(1);
    expect(result.totals.totalAllocatedMyr).toBe(
      roundMoney(
        plan.totalFuelMyr +
          plan.totalMaintenanceMyr +
          plan.totalTollMyr +
          25 +
          5 +
          12 +
          8 +
          15 +
          100
      )
    );
  });
});
