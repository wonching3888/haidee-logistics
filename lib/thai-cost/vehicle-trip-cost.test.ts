import { describe, expect, it } from "vitest";
import {
  computeThaiVehicleTripCostThb,
  normalizeTruckPlate,
  resolveThaiRouteMileageKm,
} from "@/lib/thai-cost/vehicle-trip-cost";

const ROUTES = [
  { code: "SONGKHLA", sadooMileageKm: 180 },
  { code: "PATTANI", sadooMileageKm: 280 },
];

const FUEL = { myrPerLiter: 2.15, thbPerLiter: 40 };
const FX = 8.2;

describe("normalizeTruckPlate", () => {
  it("strips spaces and hyphens", () => {
    expect(normalizeTruckPlate("PKM 9389")).toBe("PKM9389");
    expect(normalizeTruckPlate("72-3353")).toBe("723353");
  });
});

describe("resolveThaiRouteMileageKm", () => {
  it("returns route mileage", () => {
    expect(resolveThaiRouteMileageKm("SONGKHLA", ROUTES)).toBe(180);
    expect(resolveThaiRouteMileageKm("PATTANI", ROUTES)).toBe(280);
  });
});

describe("computeThaiVehicleTripCostThb", () => {
  it("computes MY dual-plate cost in THB", () => {
    // PKM 9389: fuel 2.15/2.5=0.86, maint 56428/100000=0.56428, grand=1.42428 MYR/km
    const truck = {
      plate: "PKM 9389",
      country: "MY",
      fuelEfficiencyKmPerL: 2.5,
      annualMileageKm: 100000,
      costItems: [
        { annualAmount: 50000 },
        { annualAmount: 2200 },
        { annualAmount: 3228 },
        { annualAmount: 1000 },
      ],
    };
    const r = computeThaiVehicleTripCostThb({
      truckPlate: "PKM 9389",
      station: "SONGKHLA",
      truck,
      routes: ROUTES,
      fuelPrice: FUEL,
      exchangeRateMyrPerThbUnit: FX,
    });
    expect(r.needsReview).toBe(false);
    expect(r.distanceKm).toBe(180);
    // 1.4243 * 8.2 ≈ 11.67926 THB/km * 180 ≈ 2102.27
    expect(r.costPerKmThb).toBeCloseTo(1.4243 * 8.2, 3);
    expect(r.tripCostThb).toBeCloseTo(1.4243 * 8.2 * 180, 1);
  });

  it("marks TH truck without params as needs_review cost 0", () => {
    const truck = {
      plate: "72-3353",
      country: "TH",
      fuelEfficiencyKmPerL: null,
      annualMileageKm: null,
      costItems: [
        { annualAmount: 0 },
        { annualAmount: 0 },
        { annualAmount: 0 },
        { annualAmount: 0 },
      ],
    };
    const r = computeThaiVehicleTripCostThb({
      truckPlate: "72-3353",
      station: "PATTANI",
      truck,
      routes: ROUTES,
      fuelPrice: FUEL,
      exchangeRateMyrPerThbUnit: FX,
    });
    expect(r.needsReview).toBe(true);
    expect(r.reason).toBe("needs_review");
    expect(r.tripCostThb).toBe(0);
    expect(r.distanceKm).toBe(280);
  });

  it("marks missing truck as needs_review", () => {
    const r = computeThaiVehicleTripCostThb({
      truckPlate: "7218",
      station: "SONGKHLA",
      truck: null,
      routes: ROUTES,
      fuelPrice: FUEL,
      exchangeRateMyrPerThbUnit: FX,
    });
    expect(r.needsReview).toBe(true);
    expect(r.reason).toBe("truck_not_in_master");
    expect(r.tripCostThb).toBe(0);
  });
});
