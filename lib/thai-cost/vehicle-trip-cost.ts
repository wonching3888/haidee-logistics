/**
 * Thai-segment vehicle cost (fuel + fixed cost items) per trip.
 * Dual-plate MY trucks: MYR/km × exchangeRate → THB/km × route mileage.
 * TH trucks without cost params: cost=0, needsReview=true.
 */
import {
  fuelPriceForCountry,
  type TruckCountry,
} from "@/lib/constants/truck-cost";
import {
  calcFuelCostPerKm,
  calcGrandTotalPerKm,
  calcTotalCostPerKm,
} from "@/lib/truck-cost";

export type ThaiVehicleStation = "SONGKHLA" | "PATTANI";

export const THAI_ROUTE_CODES: Record<ThaiVehicleStation, string> = {
  SONGKHLA: "SONGKHLA",
  PATTANI: "PATTANI",
};

/** Normalize plate for matching (strip spaces/hyphens, upper). */
export function normalizeTruckPlate(plate: string): string {
  return plate.replace(/[\s-]/g, "").toUpperCase();
}

export interface TruckCostInput {
  plate: string;
  country: string;
  fuelEfficiencyKmPerL: number | null;
  annualMileageKm: number | null;
  costItems: { annualAmount: number }[];
}

export interface ThaiVehicleTripCostResult {
  truckPlate: string;
  station: ThaiVehicleStation;
  distanceKm: number;
  costPerKmThb: number | null;
  tripCostThb: number;
  needsReview: boolean;
  reason: string | null;
}

export function resolveThaiRouteMileageKm(
  station: ThaiVehicleStation,
  routes: { code: string; sadooMileageKm: number | null }[]
): number | null {
  const code = THAI_ROUTE_CODES[station];
  const route = routes.find((r) => r.code === code);
  const km = route?.sadooMileageKm;
  if (km == null || !Number.isFinite(km) || km <= 0) return null;
  return km;
}

/**
 * Per-km cost in truck's native currency (MYR for MY, THB for TH).
 * Returns null when fuel efficiency or annual mileage is missing.
 */
export function computeTruckCostPerKmNative(
  truck: TruckCostInput,
  fuelPrice: { myrPerLiter: number; thbPerLiter: number }
): number | null {
  const country: TruckCountry = truck.country === "TH" ? "TH" : "MY";
  const price = fuelPriceForCountry(country, fuelPrice);
  const fuelPerKm = calcFuelCostPerKm(price, truck.fuelEfficiencyKmPerL);
  return calcGrandTotalPerKm(
    truck.costItems,
    truck.annualMileageKm,
    fuelPerKm
  );
}

export function truckNeedsCostReview(truck: TruckCostInput): boolean {
  if (truck.fuelEfficiencyKmPerL == null || truck.fuelEfficiencyKmPerL <= 0) {
    return true;
  }
  if (truck.annualMileageKm == null || truck.annualMileageKm <= 0) {
    return true;
  }
  const maint = calcTotalCostPerKm(truck.costItems, truck.annualMileageKm);
  // All-zero cost items still "configured" but flagged for review when TH.
  if (truck.country === "TH" && (maint == null || maint <= 0)) {
    return true;
  }
  return false;
}

/**
 * Cost for one Thai-segment trip in THB.
 * MY trucks: native MYR/km × exchangeRate → THB/km.
 * TH trucks: native THB/km (no FX).
 */
export function computeThaiVehicleTripCostThb(input: {
  truckPlate: string;
  station: ThaiVehicleStation;
  truck: TruckCostInput | null;
  routes: { code: string; sadooMileageKm: number | null }[];
  fuelPrice: { myrPerLiter: number; thbPerLiter: number };
  exchangeRateMyrPerThbUnit: number;
}): ThaiVehicleTripCostResult {
  const distanceKm =
    resolveThaiRouteMileageKm(input.station, input.routes) ?? 0;

  if (!input.truck) {
    return {
      truckPlate: input.truckPlate,
      station: input.station,
      distanceKm,
      costPerKmThb: null,
      tripCostThb: 0,
      needsReview: true,
      reason: "truck_not_in_master",
    };
  }

  if (truckNeedsCostReview(input.truck)) {
    return {
      truckPlate: input.truckPlate,
      station: input.station,
      distanceKm,
      costPerKmThb: null,
      tripCostThb: 0,
      needsReview: true,
      reason: "needs_review",
    };
  }

  const nativePerKm = computeTruckCostPerKmNative(
    input.truck,
    input.fuelPrice
  );
  if (nativePerKm == null || distanceKm <= 0) {
    return {
      truckPlate: input.truckPlate,
      station: input.station,
      distanceKm,
      costPerKmThb: null,
      tripCostThb: 0,
      needsReview: true,
      reason: "needs_review",
    };
  }

  const country: TruckCountry =
    input.truck.country === "TH" ? "TH" : "MY";
  const fx =
    input.exchangeRateMyrPerThbUnit > 0
      ? input.exchangeRateMyrPerThbUnit
      : 0;
  // exchangeRate is THB per 1 MYR? In this codebase exchangeRate for 2026-06 is 8.2
  // used as realCostMyr = realCostThb / exchangeRate, so exchangeRate = THB per MYR? 
  // Wait: realCostMyr = realCostThb / exchangeRate with exchangeRate=8.2
  // So 1 MYR = exchangeRate THB? No: THB / 8.2 = MYR means 8.2 THB = 1 MYR, so FX = THB per MYR.
  // MYR cost * exchangeRate = THB cost.
  const costPerKmThb =
    country === "MY"
      ? Math.round(nativePerKm * fx * 10000) / 10000
      : nativePerKm;

  const tripCostThb = Math.round(costPerKmThb * distanceKm * 100) / 100;

  return {
    truckPlate: input.truckPlate,
    station: input.station,
    distanceKm,
    costPerKmThb,
    tripCostThb,
    needsReview: false,
    reason: null,
  };
}

/** Sum vehicle costs for a month of trips. */
export function sumThaiVehicleTripCostsThb(
  trips: Array<{ truckPlate: string; station: ThaiVehicleStation }>,
  trucksByNormPlate: Map<string, TruckCostInput>,
  routes: { code: string; sadooMileageKm: number | null }[],
  fuelPrice: { myrPerLiter: number; thbPerLiter: number },
  exchangeRate: number
): {
  totalThb: number;
  needsReviewCount: number;
  byPlate: Map<string, { trips: number; costThb: number; needsReview: boolean }>;
} {
  let totalThb = 0;
  let needsReviewCount = 0;
  const byPlate = new Map<
    string,
    { trips: number; costThb: number; needsReview: boolean }
  >();

  for (const t of trips) {
    const norm = normalizeTruckPlate(t.truckPlate);
    const truck = trucksByNormPlate.get(norm) ?? null;
    const result = computeThaiVehicleTripCostThb({
      truckPlate: t.truckPlate,
      station: t.station,
      truck,
      routes,
      fuelPrice,
      exchangeRateMyrPerThbUnit: exchangeRate,
    });
    totalThb = Math.round((totalThb + result.tripCostThb) * 100) / 100;
    if (result.needsReview) needsReviewCount += 1;

    const cur = byPlate.get(norm) ?? {
      trips: 0,
      costThb: 0,
      needsReview: false,
    };
    cur.trips += 1;
    cur.costThb = Math.round((cur.costThb + result.tripCostThb) * 100) / 100;
    cur.needsReview = cur.needsReview || result.needsReview;
    byPlate.set(norm, cur);
  }

  return { totalThb, needsReviewCount, byPlate };
}
