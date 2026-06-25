import { describe, expect, it } from "vitest";
import type { RouteMasterCostRow } from "@/lib/trip-route-cost";
import {
  auditRouteMileageMaster,
  compareTripVehicleShadow,
} from "@/lib/trip-cost-engine/shadow-compare";
import { classifyFeaturedRoute } from "@/lib/trip-cost-engine/shadow-snapshot-report";

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

const ORDERED_ROUTES: RouteMasterCostRow[] = [
  { code: "KD", markets: ["KD"], sadooMileageKm: 100, tollFee: 10, tollFeeClass2: 10, tollFeeClass3: 10, fishCheckingFee: 1, parkingFee: 1 },
  { code: "BM", markets: ["BM"], sadooMileageKm: 350, tollFee: 40, tollFeeClass2: 35, tollFeeClass3: 30, fishCheckingFee: 5, parkingFee: 8 },
  { code: "A", markets: ["A"], sadooMileageKm: 500, tollFee: 50, tollFeeClass2: 45, tollFeeClass3: 40, fishCheckingFee: 4, parkingFee: 4 },
  { code: "KL", markets: ["KL"], sadooMileageKm: 800, tollFee: 70, tollFeeClass2: 60, tollFeeClass3: 55, fishCheckingFee: 4, parkingFee: 5 },
  { code: "MC", markets: ["MC"], sadooMileageKm: 1300, tollFee: 120, tollFeeClass2: 100, tollFeeClass3: 90, fishCheckingFee: 6, parkingFee: 10 },
];

describe("auditRouteMileageMaster", () => {
  it("passes when KD<BM<A<KL<MC mileages increase", () => {
    const issues = auditRouteMileageMaster(ORDERED_ROUTES);
    expect(issues.filter((i) => i.issue === "order_violation")).toHaveLength(0);
  });

  it("flags order violation when KL mileage < BM", () => {
    const bad: RouteMasterCostRow[] = [
      ...ORDERED_ROUTES.filter((r) => r.code !== "KL"),
      {
        code: "KL",
        markets: ["KL"],
        sadooMileageKm: 300,
        tollFee: 70,
        tollFeeClass2: 60,
        tollFeeClass3: 55,
        fishCheckingFee: 4,
        parkingFee: 5,
      },
    ];
    const issues = auditRouteMileageMaster(bad);
    expect(issues.some((i) => i.issue === "order_violation")).toBe(true);
  });
});

describe("compareTripVehicleShadow conservation", () => {
  it("legacy pool total matches enforced for BM+MC fixture", () => {
    const result = compareTripVehicleShadow({
      tripId: "trip-bm-mc",
      dispatchMarkets: ["BM", "MC"],
      dispatchLines: [
        {
          lineId: "l1",
          shipperId: "s1",
          shipperName: "Shipper BM",
          marketCode: "BM",
          quantity: 50,
          mcDeliveryMode: null,
        },
        {
          lineId: "l2",
          shipperId: "s2",
          shipperName: "Shipper MC",
          marketCode: "MC",
          quantity: 100,
          mcDeliveryMode: null,
        },
      ],
      routes: BM_MC_ROUTES,
      globalCosts: {
        borderPass: 25,
        epermit: 12,
        dagangNet: 8,
        forwardingOutbound: 15,
        fuelPriceMyr: 2.5,
      },
      tollClass: "class2",
      truck: {
        fuelEfficiencyKmPerL: 5,
        annualMileageKm: 120_000,
        costItems: [{ annualAmount: 0 }],
      },
      driverMyr: 0,
      tripBorderMyr: 25,
      tripFishMyr: 11,
      unloadingRows: [],
      loadingRows: [],
      routeCosts: { epermit: 12, dagangNet: 8, forwarding: 15 },
      routeEstimates: {
        borderPassMyr: 25,
        parkingMyr: 18,
        fishCheckingMyr: 11,
      },
    });

    expect(result.conservationOk).toBe(true);
    expect(result.legPlan.legs).toHaveLength(2);
    const bmFuelMaint = result.legDetails
      .flatMap((leg) => leg.byRouteGroup)
      .filter((row) => row.routeGroup === "BM")
      .reduce((sum, row) => sum + row.fuelMyr + row.maintenanceMyr, 0);
    const mcFuelMaint = result.legDetails
      .flatMap((leg) => leg.byRouteGroup)
      .filter((row) => row.routeGroup === "MC")
      .reduce((sum, row) => sum + row.fuelMyr + row.maintenanceMyr, 0);
    expect(bmFuelMaint).toBeCloseTo(58.33, 1);
    expect(mcFuelMaint).toBeCloseTo(591.67, 1);
  });
});

describe("classifyFeaturedRoute", () => {
  it("tags BM+MC, KL+MC, KL+BM+A", () => {
    expect(classifyFeaturedRoute(["BM", "MC"]).featured).toBe(true);
    expect(classifyFeaturedRoute(["KL", "MC"]).featured).toBe(true);
    expect(classifyFeaturedRoute(["KL", "BM", "A"]).featured).toBe(true);
    expect(classifyFeaturedRoute(["KL", "BM"]).featured).toBe(false);
  });
});
