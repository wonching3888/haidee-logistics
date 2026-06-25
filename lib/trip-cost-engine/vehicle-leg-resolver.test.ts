import { describe, expect, it } from "vitest";
import type { RouteMasterCostRow } from "@/lib/trip-route-cost";
import { getRouteGroups } from "@/lib/payroll-route-label";
import {
  buildVehicleLegPlan,
  incrementalTollForLeg,
  isLineEligibleForLeg,
  sortRouteGroupsByMileage,
} from "@/lib/trip-cost-engine/vehicle-leg-resolver";
import {
  legacyResolveTripRouteCosts,
  legacyResolveTripVehiclePool,
} from "@/lib/trip-cost-engine/legacy-adapter";

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

const KL_BM_MC_ROUTES: RouteMasterCostRow[] = [
  {
    code: "KL",
    markets: ["KL", "BP", "MP", "SL"],
    sadooMileageKm: 200,
    tollFee: 20,
    tollFeeClass2: 18,
    tollFeeClass3: 15,
    fishCheckingFee: 4,
    parkingFee: 5,
  },
  ...BM_MC_ROUTES,
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

describe("sortRouteGroupsByMileage", () => {
  it("orders BM before MC by sadoo mileage", () => {
    const points = sortRouteGroupsByMileage(
      getRouteGroups(["BM", "MC"]),
      BM_MC_ROUTES,
      "class2"
    );
    expect(points.map((point) => point.routeGroup)).toEqual(["BM", "MC"]);
    expect(points.map((point) => point.sadooMileageKm)).toEqual([350, 1300]);
  });
});

describe("incrementalTollForLeg", () => {
  it("uses cumulative toll delta (多减少)", () => {
    expect(incrementalTollForLeg(100, 40)).toBe(60);
    expect(incrementalTollForLeg(40, 0)).toBe(40);
  });
});

describe("buildVehicleLegPlan", () => {
  it("splits BM+MC into 350 km + 950 km legs", () => {
    const plan = buildVehicleLegPlan({
      routeGroups: getRouteGroups(["BM", "MC"]),
      routes: BM_MC_ROUTES,
      tollClass: "class2",
      fuelPriceMyr: GLOBAL.fuelPriceMyr,
      truck: TRUCK,
    });

    expect(plan.legs).toHaveLength(2);
    expect(plan.legs[0]).toMatchObject({
      toRouteGroup: "BM",
      distanceKm: 350,
      tollMyr: 35,
    });
    expect(plan.legs[1]).toMatchObject({
      toRouteGroup: "MC",
      distanceKm: 950,
      tollMyr: 65,
    });
    expect(plan.totalDistanceKm).toBe(1300);
    expect(plan.totalTollMyr).toBe(100);
  });

  it("single BM market degenerates to one full leg", () => {
    const plan = buildVehicleLegPlan({
      routeGroups: getRouteGroups(["BM"]),
      routes: BM_MC_ROUTES,
      tollClass: "class2",
      fuelPriceMyr: GLOBAL.fuelPriceMyr,
      truck: TRUCK,
    });

    expect(plan.legs).toHaveLength(1);
    expect(plan.legs[0]?.distanceKm).toBe(350);
    expect(plan.totalDistanceKm).toBe(350);
  });

  it("KL+BM+MC produces three incremental legs", () => {
    const plan = buildVehicleLegPlan({
      routeGroups: getRouteGroups(["KL", "BM", "MC"]),
      routes: KL_BM_MC_ROUTES,
      tollClass: "class2",
      fuelPriceMyr: GLOBAL.fuelPriceMyr,
      truck: TRUCK,
    });

    expect(plan.legs).toHaveLength(3);
    expect(plan.legs.map((leg) => leg.distanceKm)).toEqual([200, 150, 950]);
    expect(plan.totalDistanceKm).toBe(1300);
  });

  it("★ conserves total variable + toll pools vs legacy max-mileage trip", () => {
    const markets = ["BM", "MC"];
    const legacyPool = legacyResolveTripVehiclePool({
      dispatchMarkets: markets,
      routes: BM_MC_ROUTES,
      globalCosts: GLOBAL,
      tollClass: "class2",
      truck: TRUCK,
    });
    const legacyRoute = legacyResolveTripRouteCosts(
      markets,
      BM_MC_ROUTES,
      GLOBAL,
      "class2"
    );

    const plan = buildVehicleLegPlan({
      routeGroups: getRouteGroups(markets),
      routes: BM_MC_ROUTES,
      tollClass: "class2",
      fuelPriceMyr: GLOBAL.fuelPriceMyr,
      truck: TRUCK,
    });

    expect(plan.totalDistanceKm).toBe(legacyPool.tripMileageKm);
    expect(plan.totalFuelMyr).toBe(legacyPool.fuelMyr);
    expect(plan.totalMaintenanceMyr).toBe(legacyPool.maintenanceMyr);
    expect(plan.totalTollMyr).toBe(legacyRoute.tollFee);
    expect(plan.totalVariableCostMyr).toBe(
      legacyPool.fuelMyr + legacyPool.maintenanceMyr
    );
  });
});

describe("isLineEligibleForLeg", () => {
  const groups = ["BM", "MC"];

  it("BM cargo only on leg0; MC on both legs", () => {
    expect(isLineEligibleForLeg("BM", 0, groups)).toBe(true);
    expect(isLineEligibleForLeg("BM", 1, groups)).toBe(false);
    expect(isLineEligibleForLeg("MC", 0, groups)).toBe(true);
    expect(isLineEligibleForLeg("MC", 1, groups)).toBe(true);
  });
});
