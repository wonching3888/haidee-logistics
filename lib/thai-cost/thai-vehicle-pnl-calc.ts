/**
 * Pure THB calculators for Songkhla / Pattani Thai-vehicle PNL.
 * Do not import/reuse computeVehicleTripIncomeThb / computePattaniHandlingCosts / etc.
 */
import type { ThaiVehicleStation } from "@/lib/thai-cost/vehicle-trip-cost";
import {
  THAI_VEHICLE_PNL_DRIVER_TRIP_BUDGET,
  THAI_VEHICLE_PNL_HANDLING,
  THAI_VEHICLE_PNL_INCOME,
  THAI_VEHICLE_PNL_WORKER_WEIGHT,
  THAI_VEHICLE_RENTED_NOTES_PREFIX,
} from "@/lib/thai-cost/thai-vehicle-pnl-constants";
import {
  fuelPriceForCountry,
  type TruckCountry,
} from "@/lib/constants/truck-cost";
import {
  calcFuelCostPerKm,
  calcGrandTotalPerKm,
} from "@/lib/truck-cost";
import type {
  ThaiRouteCostRow,
  TruckCostInput,
} from "@/lib/thai-cost/vehicle-trip-cost";
import {
  normalizeTruckPlate,
  resolveThaiRouteFixedFeesThb,
  resolveThaiRouteMileageKm,
} from "@/lib/thai-cost/vehicle-trip-cost";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/** Songkhla DB stores small+large; merge to single crate qty for PNL / UI. */
export function thaiVehiclePnlMergeSongkhlaCrateQty(input: {
  smallCrateTotalQty: number;
  largeCrateTotalQty: number;
}): number {
  return Math.max(0, input.smallCrateTotalQty) + Math.max(0, input.largeCrateTotalQty);
}

export function thaiVehiclePnlIsRentedTrip(notes: string | null | undefined): boolean {
  return !!notes && notes.startsWith(THAI_VEHICLE_RENTED_NOTES_PREFIX);
}

export function thaiVehiclePnlParseRentedName(
  notes: string | null | undefined
): string | null {
  if (!thaiVehiclePnlIsRentedTrip(notes)) return null;
  const rest = notes!.slice(THAI_VEHICLE_RENTED_NOTES_PREFIX.length);
  const name = rest.split(";")[0]?.trim() ?? "";
  return name || null;
}

export function thaiVehiclePnlIncomeThb(
  station: ThaiVehicleStation,
  crateQty: number,
  boxQty: number
): number {
  const rates = THAI_VEHICLE_PNL_INCOME[station];
  return roundMoney(
    Math.max(0, crateQty) * rates.crate + Math.max(0, boxQty) * rates.box
  );
}

export function thaiVehiclePnlHandlingFeeThb(
  station: ThaiVehicleStation,
  crateQty: number,
  boxQty: number
): number {
  const rates = THAI_VEHICLE_PNL_HANDLING[station];
  return roundMoney(
    Math.max(0, crateQty) * rates.crate + Math.max(0, boxQty) * rates.box
  );
}

export function thaiVehiclePnlDriverTripBudgetThb(
  station: ThaiVehicleStation
): number {
  return THAI_VEHICLE_PNL_DRIVER_TRIP_BUDGET[station];
}

export function thaiVehiclePnlWeightedQty(
  station: ThaiVehicleStation,
  crateQty: number,
  boxQty: number
): number {
  const w = THAI_VEHICLE_PNL_WORKER_WEIGHT[station];
  return Math.max(0, crateQty) * w.crate + Math.max(0, boxQty) * w.box;
}

/**
 * Own-fleet trip cost for Thai-vehicle PNL only.
 * Always includes route toll/parking; variable fuel+maint when truck params allow.
 * Reads truck.costItems (annual amounts) via calcGrandTotalPerKm.
 */
export function thaiVehiclePnlOwnFleetTripCostThb(input: {
  truckPlate: string;
  station: ThaiVehicleStation;
  truck: TruckCostInput | null;
  routes: ThaiRouteCostRow[];
  fuelPrice: { myrPerLiter: number; thbPerLiter: number };
  exchangeRateMyrPerThbUnit: number;
}): {
  tripCostThb: number;
  variableCostThb: number;
  tollFeeThb: number;
  parkingFeeThb: number;
  needsReview: boolean;
  reason: string | null;
} {
  const distanceKm =
    resolveThaiRouteMileageKm(input.station, input.routes) ?? 0;
  const { tollFeeThb, parkingFeeThb } = resolveThaiRouteFixedFeesThb(
    input.station,
    input.routes
  );
  const fixedThb = roundMoney(tollFeeThb + parkingFeeThb);

  if (!input.truck) {
    return {
      tripCostThb: fixedThb,
      variableCostThb: 0,
      tollFeeThb,
      parkingFeeThb,
      needsReview: true,
      reason: "truck_not_in_master",
    };
  }

  const country: TruckCountry =
    input.truck.country === "TH" ? "TH" : "MY";
  const price = fuelPriceForCountry(country, input.fuelPrice);
  const fuelPerKm = calcFuelCostPerKm(
    price,
    input.truck.fuelEfficiencyKmPerL
  );
  const nativePerKm = calcGrandTotalPerKm(
    input.truck.costItems,
    input.truck.annualMileageKm,
    fuelPerKm
  );

  if (
    nativePerKm == null ||
    distanceKm <= 0 ||
    input.truck.fuelEfficiencyKmPerL == null ||
    input.truck.fuelEfficiencyKmPerL <= 0 ||
    input.truck.annualMileageKm == null ||
    input.truck.annualMileageKm <= 0
  ) {
    return {
      tripCostThb: fixedThb,
      variableCostThb: 0,
      tollFeeThb,
      parkingFeeThb,
      needsReview: true,
      reason: "needs_review",
    };
  }

  const fx =
    input.exchangeRateMyrPerThbUnit > 0
      ? input.exchangeRateMyrPerThbUnit
      : 0;
  const costPerKmThb =
    country === "MY"
      ? Math.round(nativePerKm * fx * 10000) / 10000
      : nativePerKm;
  const variableCostThb = roundMoney(costPerKmThb * distanceKm);

  return {
    tripCostThb: roundMoney(variableCostThb + fixedThb),
    variableCostThb,
    tollFeeThb,
    parkingFeeThb,
    needsReview: false,
    reason: null,
  };
}

export function thaiVehiclePnlResolveVehicleCostThb(input: {
  isRented: boolean;
  rentedTripCostThb: number | null;
  ownFleet: ReturnType<typeof thaiVehiclePnlOwnFleetTripCostThb>;
}): {
  vehicleCostThb: number;
  needsReview: boolean;
  reason: string | null;
  isRented: boolean;
} {
  if (input.isRented) {
    if (input.rentedTripCostThb == null) {
      return {
        vehicleCostThb: 0,
        needsReview: true,
        reason: "rented_cost_missing",
        isRented: true,
      };
    }
    return {
      vehicleCostThb: roundMoney(input.rentedTripCostThb),
      needsReview: false,
      reason: null,
      isRented: true,
    };
  }
  return {
    vehicleCostThb: input.ownFleet.tripCostThb,
    needsReview: input.ownFleet.needsReview,
    reason: input.ownFleet.reason,
    isRented: false,
  };
}

/** Same share rule as songkhla/pattani cost-service: stationTrips / (sk+ptn). */
export function thaiVehiclePnlAllocateBaseWageThb(input: {
  baseWage: number;
  stationTrips: number;
  otherStationTrips: number;
}): number {
  const total = input.stationTrips + input.otherStationTrips;
  if (total <= 0 || input.stationTrips <= 0) return 0;
  const share = input.stationTrips / total;
  return roundMoney(input.baseWage * share);
}

export function thaiVehiclePnlAllocateMonthlyWorkerToTripThb(input: {
  stationMonthlyWorkerTotalThb: number;
  tripWeightedQty: number;
  monthWeightedQty: number;
}): number {
  if (
    input.stationMonthlyWorkerTotalThb <= 0 ||
    input.monthWeightedQty <= 0 ||
    input.tripWeightedQty <= 0
  ) {
    return 0;
  }
  return roundMoney(
    (input.stationMonthlyWorkerTotalThb * input.tripWeightedQty) /
      input.monthWeightedQty
  );
}

export function thaiVehiclePnlNormalizePlate(plate: string): string {
  return normalizeTruckPlate(plate);
}
