/**
 * Songkhla / Pattani Thai-vehicle PNL (THB) — month aggregate over vehicle trips.
 * Replaces prior internalCostMyr − realCostMyr snapshot logic in get*Pnl.
 */
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import { yearMonthKey } from "@/lib/constants/thai-cost";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import {
  detectThaiPnlCompleteness,
  type PnlCompleteness,
} from "@/lib/thai-cost/pnl-completeness";
import { computeMonthlyWorkerTotal } from "@/lib/thai-cost/sadao-cost";
import {
  thaiVehiclePnlAllocateBaseWageThb,
  thaiVehiclePnlAllocateMonthlyWorkerToTripThb,
  thaiVehiclePnlDriverTripBudgetThb,
  thaiVehiclePnlHandlingFeeThb,
  thaiVehiclePnlIncomeThb,
  thaiVehiclePnlIsRentedTrip,
  thaiVehiclePnlNormalizePlate,
  thaiVehiclePnlOwnFleetTripCostThb,
  thaiVehiclePnlParseRentedName,
  thaiVehiclePnlResolveVehicleCostThb,
  thaiVehiclePnlWeightedQty,
} from "@/lib/thai-cost/thai-vehicle-pnl-calc";
import { THAI_DRIVER_OTHER_NAME } from "@/lib/thai-cost/thai-vehicle-pnl-constants";
import type {
  ThaiRouteCostRow,
  ThaiVehicleStation,
  TruckCostInput,
} from "@/lib/thai-cost/vehicle-trip-cost";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export interface ThaiVehiclePnlTripRow {
  id: string;
  date: string;
  truckPlate: string;
  driverId: string | null;
  driverName: string | null;
  isOtherDriver: boolean;
  isRented: boolean;
  rentedDriverName: string | null;
  crateQty: number;
  boxQty: number;
  incomeThb: number;
  vehicleCostThb: number;
  driverTripBudgetThb: number;
  driverBaseWageAllocatedThb: number;
  handlingFeeThb: number;
  monthlyWorkerAllocatedThb: number;
  costThb: number;
  profitThb: number;
  needsReview: boolean;
  costReason: string | null;
}

export interface ThaiVehiclePnlDetail {
  year: number;
  month: number;
  station: ThaiVehicleStation;
  incomeThb: number;
  vehicleCostThb: number;
  driverTripBudgetThb: number;
  driverBaseWageAllocatedThb: number;
  handlingFeeThb: number;
  monthlyWorkerAllocatedThb: number;
  /** Station monthly workers total before trip allocation (for display). */
  monthlyWorkerStationTotalThb: number;
  costThb: number;
  profitThb: number;
  trips: ThaiVehiclePnlTripRow[];
  completeness: PnlCompleteness;
  /** @deprecated kept null — PNL is THB-only now. */
  exchangeRate: number;
}

function rentedLookupKey(
  date: string,
  plate: string,
  station: string,
  driverName: string
): string {
  return `${date}|${thaiVehiclePnlNormalizePlate(plate)}|${station}|${driverName.trim().toUpperCase()}`;
}

async function loadPnlContext(year: number, month: number) {
  const ym = yearMonthKey(year, month);
  const [routes, trucks, fuelRow, fxRow] = await Promise.all([
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
  ]);

  const trucksByNormPlate = new Map<string, TruckCostInput>();
  for (const t of trucks) {
    trucksByNormPlate.set(thaiVehiclePnlNormalizePlate(t.plate), {
      plate: t.plate,
      country: t.country,
      fuelEfficiencyKmPerL: decimalToNumber(t.fuelEfficiencyKmPerL),
      annualMileageKm: decimalToNumber(t.annualMileageKm),
      costItems: t.costItems.map((c) => ({
        annualAmount: decimalToNumber(c.annualAmount) ?? 0,
      })),
    });
  }

  return {
    routes: routes.map(
      (r): ThaiRouteCostRow => ({
        code: r.code,
        sadooMileageKm: decimalToNumber(r.sadooMileageKm),
        tollFee: decimalToNumber(r.tollFee),
        parkingFee: decimalToNumber(r.parkingFee),
      })
    ),
    trucksByNormPlate,
    fuelPrice: {
      myrPerLiter: decimalToNumber(fuelRow?.myrPerLiter) ?? 2.15,
      thbPerLiter: decimalToNumber(fuelRow?.thbPerLiter) ?? 40,
    },
    exchangeRate: decimalToNumber(fxRow?.rate) ?? DEFAULT_EXCHANGE_RATE,
  };
}

export async function computeThaiVehiclePnlForStation(
  station: ThaiVehicleStation,
  year: number,
  month: number
): Promise<ThaiVehiclePnlDetail> {
  const { start, end } = getMonthDateRange(year, month);
  const [ctx, tripRows, drivers, workers, rentedTrips, completeness] =
    await Promise.all([
      loadPnlContext(year, month),
      prisma.thaiVehicleTripDaily.findMany({
        where: {
          station,
          date: { gte: start, lte: end },
        },
        include: { driver: { select: { id: true, name: true, baseWage: true } } },
        orderBy: [{ date: "asc" }, { truckPlate: "asc" }],
      }),
      prisma.thaiDriver.findMany({ where: { active: true } }),
      prisma.thaiMonthlyWorker.findMany({
        where: { station, active: true },
      }),
      prisma.thaiRentedVehicleTrip.findMany({
        where: { station, date: { gte: start, lte: end } },
        select: {
          date: true,
          station: true,
          driverName: true,
          truckPlate: true,
          tripCost: true,
        },
      }),
      detectThaiPnlCompleteness(station, year, month),
    ]);

  const monthlyWorkerStationTotalThb = roundMoney(
    workers.reduce((sum, w) => {
      return (
        sum +
        computeMonthlyWorkerTotal({
          monthlyWage: decimalToNumber(w.monthlyWage) ?? 0,
          lunchAllowance: decimalToNumber(w.lunchAllowance) ?? 0,
          fuelAllowance: decimalToNumber(w.fuelAllowance) ?? 0,
          rentRoomAllowance: decimalToNumber(w.rentRoomAllowance) ?? 0,
        })
      );
    }, 0)
  );

  const rentedCostByKey = new Map<string, number>();
  for (const r of rentedTrips) {
    const dateStr = r.date.toISOString().slice(0, 10);
    const plate = r.truckPlate ?? "";
    rentedCostByKey.set(
      rentedLookupKey(dateStr, plate, r.station, r.driverName),
      decimalToNumber(r.tripCost) ?? 0
    );
  }

  // Month trip counts per formal driver (both stations) for base-wage share.
  const allMonthTrips = await prisma.thaiVehicleTripDaily.findMany({
    where: { date: { gte: start, lte: end }, driverId: { not: null } },
    select: { driverId: true, station: true },
  });
  const tripCountsByDriver = new Map<
    string,
    { songkhla: number; pattani: number }
  >();
  for (const t of allMonthTrips) {
    if (!t.driverId) continue;
    const cur = tripCountsByDriver.get(t.driverId) ?? {
      songkhla: 0,
      pattani: 0,
    };
    if (t.station === "SONGKHLA") cur.songkhla += 1;
    else if (t.station === "PATTANI") cur.pattani += 1;
    tripCountsByDriver.set(t.driverId, cur);
  }

  const driverBaseById = new Map(
    drivers.map((d) => [d.id, decimalToNumber(d.baseWage) ?? 0])
  );

  // Per-driver base wage allocated to this station (same formula as cost-service).
  const stationBaseByDriver = new Map<string, number>();
  for (const d of drivers) {
    const counts = tripCountsByDriver.get(d.id) ?? {
      songkhla: 0,
      pattani: 0,
    };
    const stationTrips =
      station === "SONGKHLA" ? counts.songkhla : counts.pattani;
    const otherTrips =
      station === "SONGKHLA" ? counts.pattani : counts.songkhla;
    stationBaseByDriver.set(
      d.id,
      thaiVehiclePnlAllocateBaseWageThb({
        baseWage: driverBaseById.get(d.id) ?? 0,
        stationTrips,
        otherStationTrips: otherTrips,
      })
    );
  }

  const monthWeightedQty = tripRows.reduce(
    (s, t) => s + thaiVehiclePnlWeightedQty(station, t.tongQty, t.boxQty),
    0
  );

  // Spread each driver's station-allocated base across their trips at this station.
  const tripsPerDriverAtStation = new Map<string, number>();
  for (const t of tripRows) {
    if (!t.driverId) continue;
    tripsPerDriverAtStation.set(
      t.driverId,
      (tripsPerDriverAtStation.get(t.driverId) ?? 0) + 1
    );
  }

  const trips: ThaiVehiclePnlTripRow[] = tripRows.map((t) => {
    const dateStr = t.date.toISOString().slice(0, 10);
    const isRented = thaiVehiclePnlIsRentedTrip(t.notes);
    const rentedName = thaiVehiclePnlParseRentedName(t.notes);
    const isOtherDriver =
      !isRented && t.driver?.name === THAI_DRIVER_OTHER_NAME;

    const crateQty = t.tongQty;
    const boxQty = t.boxQty;
    const incomeThb = thaiVehiclePnlIncomeThb(station, crateQty, boxQty);
    const handlingFeeThb = thaiVehiclePnlHandlingFeeThb(
      station,
      crateQty,
      boxQty
    );
    const driverTripBudgetThb = thaiVehiclePnlDriverTripBudgetThb(station);

    const truck =
      ctx.trucksByNormPlate.get(thaiVehiclePnlNormalizePlate(t.truckPlate)) ??
      null;
    const ownFleet = thaiVehiclePnlOwnFleetTripCostThb({
      truckPlate: t.truckPlate,
      station,
      truck,
      routes: ctx.routes,
      fuelPrice: ctx.fuelPrice,
      exchangeRateMyrPerThbUnit: ctx.exchangeRate,
    });

    let rentedTripCostThb: number | null = null;
    if (isRented && rentedName) {
      const key = rentedLookupKey(
        dateStr,
        t.truckPlate,
        station,
        rentedName
      );
      rentedTripCostThb = rentedCostByKey.has(key)
        ? (rentedCostByKey.get(key) ?? 0)
        : null;
    }

    const vehicle = thaiVehiclePnlResolveVehicleCostThb({
      isRented,
      rentedTripCostThb,
      ownFleet,
    });

    let driverBaseWageAllocatedThb = 0;
    if (t.driverId && !isRented) {
      const stationTotal = stationBaseByDriver.get(t.driverId) ?? 0;
      const n = tripsPerDriverAtStation.get(t.driverId) ?? 0;
      driverBaseWageAllocatedThb =
        n > 0 ? roundMoney(stationTotal / n) : 0;
    }

    const tripWeighted = thaiVehiclePnlWeightedQty(station, crateQty, boxQty);
    const monthlyWorkerAllocatedThb =
      thaiVehiclePnlAllocateMonthlyWorkerToTripThb({
        stationMonthlyWorkerTotalThb: monthlyWorkerStationTotalThb,
        tripWeightedQty: tripWeighted,
        monthWeightedQty,
      });

    const costThb = roundMoney(
      vehicle.vehicleCostThb +
        driverTripBudgetThb +
        driverBaseWageAllocatedThb +
        handlingFeeThb +
        monthlyWorkerAllocatedThb
    );
    const profitThb = roundMoney(incomeThb - costThb);

    return {
      id: t.id,
      date: dateStr,
      truckPlate: t.truckPlate,
      driverId: t.driverId,
      driverName: isRented
        ? rentedName
        : (t.driver?.name ?? null),
      isOtherDriver,
      isRented,
      rentedDriverName: rentedName,
      crateQty,
      boxQty,
      incomeThb,
      vehicleCostThb: vehicle.vehicleCostThb,
      driverTripBudgetThb,
      driverBaseWageAllocatedThb,
      handlingFeeThb,
      monthlyWorkerAllocatedThb,
      costThb,
      profitThb,
      needsReview: vehicle.needsReview,
      costReason: vehicle.reason,
    };
  });

  const incomeThb = roundMoney(trips.reduce((s, t) => s + t.incomeThb, 0));
  const vehicleCostThb = roundMoney(
    trips.reduce((s, t) => s + t.vehicleCostThb, 0)
  );
  const driverTripBudgetThb = roundMoney(
    trips.reduce((s, t) => s + t.driverTripBudgetThb, 0)
  );
  const driverBaseWageAllocatedThb = roundMoney(
    trips.reduce((s, t) => s + t.driverBaseWageAllocatedThb, 0)
  );
  const handlingFeeThb = roundMoney(
    trips.reduce((s, t) => s + t.handlingFeeThb, 0)
  );
  const monthlyWorkerAllocatedThb = roundMoney(
    trips.reduce((s, t) => s + t.monthlyWorkerAllocatedThb, 0)
  );
  const costThb = roundMoney(
    vehicleCostThb +
      driverTripBudgetThb +
      driverBaseWageAllocatedThb +
      handlingFeeThb +
      monthlyWorkerAllocatedThb
  );

  return {
    year,
    month,
    station,
    incomeThb,
    vehicleCostThb,
    driverTripBudgetThb,
    driverBaseWageAllocatedThb,
    handlingFeeThb,
    monthlyWorkerAllocatedThb,
    monthlyWorkerStationTotalThb,
    costThb,
    profitThb: roundMoney(incomeThb - costThb),
    trips,
    completeness,
    exchangeRate: ctx.exchangeRate,
  };
}
