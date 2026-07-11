import { describe, expect, it } from "vitest";
import {
  thaiVehiclePnlAllocateBaseWageThb,
  thaiVehiclePnlAllocateMonthlyWorkerToTripThb,
  thaiVehiclePnlDriverTripBudgetThb,
  thaiVehiclePnlHandlingFeeThb,
  thaiVehiclePnlIncomeThb,
  thaiVehiclePnlIsRentedTrip,
  thaiVehiclePnlMergeSongkhlaCrateQty,
  thaiVehiclePnlOwnFleetTripCostThb,
  thaiVehiclePnlWeightedQty,
} from "@/lib/thai-cost/thai-vehicle-pnl-calc";
import { THAI_VEHICLE_RENTED_NOTES_PREFIX } from "@/lib/thai-cost/thai-vehicle-pnl-constants";

describe("thaiVehiclePnlIncomeThb", () => {
  it("Songkhla crate×50 + box×25", () => {
    expect(thaiVehiclePnlIncomeThb("SONGKHLA", 10, 4)).toBe(10 * 50 + 4 * 25);
  });
  it("Pattani crate×70 + box×35", () => {
    expect(thaiVehiclePnlIncomeThb("PATTANI", 10, 4)).toBe(10 * 70 + 4 * 35);
  });
});

describe("thaiVehiclePnlHandlingFeeThb", () => {
  it("Songkhla crate×3 + box×2", () => {
    expect(thaiVehiclePnlHandlingFeeThb("SONGKHLA", 10, 4)).toBe(10 * 3 + 4 * 2);
  });
  it("Pattani crate×22.2 + box×5", () => {
    expect(thaiVehiclePnlHandlingFeeThb("PATTANI", 10, 4)).toBe(10 * 22.2 + 4 * 5);
  });
});

describe("thaiVehiclePnlDriverTripBudgetThb", () => {
  it("SK 700 / PTN 1200", () => {
    expect(thaiVehiclePnlDriverTripBudgetThb("SONGKHLA")).toBe(700);
    expect(thaiVehiclePnlDriverTripBudgetThb("PATTANI")).toBe(1200);
  });
});

describe("thaiVehiclePnlWeightedQty", () => {
  it("SK 1:1 and PTN 4:1", () => {
    expect(thaiVehiclePnlWeightedQty("SONGKHLA", 10, 5)).toBe(15);
    expect(thaiVehiclePnlWeightedQty("PATTANI", 10, 5)).toBe(10 * 4 + 5);
  });
});

describe("thaiVehiclePnlMergeSongkhlaCrateQty", () => {
  it("sums small+large", () => {
    expect(
      thaiVehiclePnlMergeSongkhlaCrateQty({
        smallCrateTotalQty: 12,
        largeCrateTotalQty: 3,
      })
    ).toBe(15);
  });
});

describe("thaiVehiclePnlIsRentedTrip", () => {
  it("only RENTED: prefix", () => {
    expect(thaiVehiclePnlIsRentedTrip(`${THAI_VEHICLE_RENTED_NOTES_PREFIX}BANHENG`)).toBe(
      true
    );
    expect(thaiVehiclePnlIsRentedTrip("OTHER:someone")).toBe(false);
    expect(thaiVehiclePnlIsRentedTrip(null)).toBe(false);
  });
});

describe("thaiVehiclePnlAllocateBaseWageThb", () => {
  it("allocates by station trip share", () => {
    expect(
      thaiVehiclePnlAllocateBaseWageThb({
        baseWage: 8000,
        stationTrips: 2,
        otherStationTrips: 2,
      })
    ).toBe(4000);
  });
});

describe("thaiVehiclePnlAllocateMonthlyWorkerToTripThb", () => {
  it("allocates by weighted qty", () => {
    expect(
      thaiVehiclePnlAllocateMonthlyWorkerToTripThb({
        stationMonthlyWorkerTotalThb: 1000,
        tripWeightedQty: 25,
        monthWeightedQty: 100,
      })
    ).toBe(250);
  });
});

describe("thaiVehiclePnlOwnFleetTripCostThb", () => {
  it("reads truck_cost_items into variable cost", () => {
    const r = thaiVehiclePnlOwnFleetTripCostThb({
      truckPlate: "PKM 9389",
      station: "SONGKHLA",
      truck: {
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
      },
      routes: [
        { code: "SONGKHLA", sadooMileageKm: 180, tollFee: 0, parkingFee: 90 },
      ],
      fuelPrice: { myrPerLiter: 2.15, thbPerLiter: 40 },
      exchangeRateMyrPerThbUnit: 8.2,
    });
    expect(r.needsReview).toBe(false);
    expect(r.parkingFeeThb).toBe(90);
    expect(r.variableCostThb).toBeGreaterThan(0);
    expect(r.tripCostThb).toBeCloseTo(r.variableCostThb + 90, 1);
  });
});
