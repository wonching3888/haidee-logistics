/**
 * Per-trip vehicle income, cost, and P&L for Thai segment operations.
 */
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import type { ThaiSegmentRates } from "@/lib/constants/thai-segment-rates";
import { decimalToNumber } from "@/lib/freight-rates";
import { listGlobalCostSettings } from "@/lib/global-cost-settings-service";
import { parseThaiSegmentRates } from "@/lib/constants/thai-segment-rates";
import { prisma } from "@/lib/prisma";
import { yearMonthKey } from "@/lib/constants/thai-cost";
import {
  computeVehicleTripIncomeThb,
  type VehicleTripCargoQty,
} from "@/lib/thai-cost/vehicle-trip-income";
import {
  computeThaiVehicleTripCostThb,
  normalizeTruckPlate,
  type ThaiRouteCostRow,
  type ThaiVehicleStation,
  type TruckCostInput,
} from "@/lib/thai-cost/vehicle-trip-cost";

export interface VehicleTripPlRow {
  id: string;
  date: string;
  truckPlate: string;
  driverName: string | null;
  station: ThaiVehicleStation;
  tongQty: number;
  boxQty: number;
  incomeThb: number;
  costThb: number;
  profitThb: number;
  needsReview: boolean;
  costReason: string | null;
  isRented: boolean;
}

export interface VehiclePlContext {
  segmentRates: ThaiSegmentRates;
  routes: ThaiRouteCostRow[];
  fuelPrice: { myrPerLiter: number; thbPerLiter: number };
  exchangeRate: number;
  trucksByNormPlate: Map<string, TruckCostInput>;
  rentedCostByKey: Map<string, number>;
}

function rentedTripKey(
  date: string,
  plate: string,
  station: string,
  driverName: string
): string {
  return `${date}|${normalizeTruckPlate(plate)}|${station}|${driverName.trim().toUpperCase()}`;
}

export async function loadVehiclePlContext(
  year: number,
  month: number
): Promise<VehiclePlContext> {
  const ym = yearMonthKey(year, month);
  const [globalSettings, routes, trucks, fuelRow, fxRow, rentedTrips] =
    await Promise.all([
      listGlobalCostSettings(),
      prisma.routeMaster.findMany({
        select: {
          code: true,
          sadooMileageKm: true,
          tollFee: true,
          parkingFee: true,
        },
      }),
      prisma.truck.findMany({
        select: {
          plate: true,
          country: true,
          fuelEfficiencyKmPerL: true,
          annualMileageKm: true,
          costItems: { select: { annualAmount: true } },
        },
      }),
      prisma.fuelPrice.findUnique({ where: { id: "default" } }),
      prisma.exchangeRate.findUnique({ where: { yearMonth: ym } }),
      prisma.thaiRentedVehicleTrip.findMany({
        where: {
          date: {
            gte: new Date(Date.UTC(year, month - 1, 1)),
            lte: new Date(Date.UTC(year, month, 0)),
          },
        },
        select: {
          date: true,
          station: true,
          driverName: true,
          truckPlate: true,
          tripCost: true,
        },
      }),
    ]);

  const trucksByNormPlate = new Map<string, TruckCostInput>();
  for (const t of trucks) {
    trucksByNormPlate.set(normalizeTruckPlate(t.plate), {
      plate: t.plate,
      country: t.country,
      fuelEfficiencyKmPerL: decimalToNumber(t.fuelEfficiencyKmPerL),
      annualMileageKm: decimalToNumber(t.annualMileageKm),
      costItems: t.costItems.map((c) => ({
        annualAmount: decimalToNumber(c.annualAmount) ?? 0,
      })),
    });
  }

  const rentedCostByKey = new Map<string, number>();
  for (const r of rentedTrips) {
    const dateStr = r.date.toISOString().slice(0, 10);
    const plate = r.truckPlate ?? "";
    const key = rentedTripKey(dateStr, plate, r.station, r.driverName);
    rentedCostByKey.set(key, decimalToNumber(r.tripCost) ?? 0);
  }

  return {
    segmentRates: parseThaiSegmentRates(globalSettings),
    routes: routes.map((r) => ({
      code: r.code,
      sadooMileageKm: decimalToNumber(r.sadooMileageKm),
      tollFee: decimalToNumber(r.tollFee),
      parkingFee: decimalToNumber(r.parkingFee),
    })),
    fuelPrice: {
      myrPerLiter: decimalToNumber(fuelRow?.myrPerLiter) ?? 2.15,
      thbPerLiter: decimalToNumber(fuelRow?.thbPerLiter) ?? 40,
    },
    exchangeRate: decimalToNumber(fxRow?.rate) ?? DEFAULT_EXCHANGE_RATE,
    trucksByNormPlate,
    rentedCostByKey,
  };
}

export function computeVehicleTripPl(
  trip: {
    id: string;
    date: string;
    truckPlate: string;
    driverName: string | null;
    station: ThaiVehicleStation;
    tongQty: number;
    boxQty: number;
    notes: string | null;
  },
  ctx: VehiclePlContext
): VehicleTripPlRow {
  const cargo: VehicleTripCargoQty = {
    tongQty: trip.tongQty,
    boxQty: trip.boxQty,
  };
  const incomeThb = computeVehicleTripIncomeThb(
    trip.station,
    cargo,
    ctx.segmentRates
  );

  const isRented =
    trip.notes?.includes("RENTED:") ||
    trip.driverName?.startsWith("RENTED:") ||
    false;

  let costThb = 0;
  let needsReview = false;
  let costReason: string | null = null;

  if (isRented && trip.driverName) {
    const key = rentedTripKey(
      trip.date,
      trip.truckPlate,
      trip.station,
      trip.driverName.replace(/^RENTED:/, "")
    );
    const rentedCost = ctx.rentedCostByKey.get(key);
    if (rentedCost != null) {
      costThb = rentedCost;
    } else {
      needsReview = true;
      costReason = "rented_cost_missing";
    }
  } else {
    const norm = normalizeTruckPlate(trip.truckPlate);
    const truck = ctx.trucksByNormPlate.get(norm) ?? null;
    const costResult = computeThaiVehicleTripCostThb({
      truckPlate: trip.truckPlate,
      station: trip.station,
      truck,
      routes: ctx.routes,
      fuelPrice: ctx.fuelPrice,
      exchangeRateMyrPerThbUnit: ctx.exchangeRate,
    });
    costThb = costResult.tripCostThb;
    needsReview = costResult.needsReview;
    costReason = costResult.reason;
  }

  const profitThb = Math.round((incomeThb - costThb) * 100) / 100;

  return {
    id: trip.id,
    date: trip.date,
    truckPlate: trip.truckPlate,
    driverName: trip.driverName,
    station: trip.station,
    tongQty: trip.tongQty,
    boxQty: trip.boxQty,
    incomeThb,
    costThb,
    profitThb,
    needsReview,
    costReason,
    isRented,
  };
}

export function sumVehiclePlRows(rows: VehicleTripPlRow[]): {
  incomeThb: number;
  costThb: number;
  profitThb: number;
} {
  let incomeThb = 0;
  let costThb = 0;
  for (const r of rows) {
    incomeThb += r.incomeThb;
    costThb += r.costThb;
  }
  return {
    incomeThb: Math.round(incomeThb * 100) / 100,
    costThb: Math.round(costThb * 100) / 100,
    profitThb: Math.round((incomeThb - costThb) * 100) / 100,
  };
}
