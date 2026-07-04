import { yearMonthKey } from "@/lib/constants/thai-cost";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import {
  computeDailyLaborDayCost,
  computeMonthlyWorkerTotal,
  computeSadaoHandlingCommission,
  sumSadaoMonthlyCost,
  type SadaoMonthlyCostSummary,
} from "@/lib/thai-cost/sadao-cost";
import {
  resolveThaiCostRatesForMonth,
  type ResolvedThaiCostRates,
} from "@/lib/thai-cost/rate-settings";

export interface SongkhlaDriverCostDetail {
  driverId: string;
  name: string;
  baseWage: number;
  baseWageAllocatedThb: number;
  songkhlaTrips: number;
  pattaniTrips: number;
  tripCommissionThb: number;
}

export interface SongkhlaMonthlyCostDetail extends SadaoMonthlyCostSummary {
  year: number;
  month: number;
  monthlyWorkers: Array<{
    id: string;
    name: string;
    monthlyWage: number;
    lunchAllowance: number;
    fuelAllowance: number;
    rentRoomAllowance: number;
    totalThb: number;
  }>;
  dailyLaborRosterCount: number;
  attendanceDays: number;
  handlingDays: number;
  driverBaseWageAllocatedThb: number;
  driverTripCommissionThb: number;
  driverTotalThb: number;
  rentedVehicleCostThb: number;
  drivers: SongkhlaDriverCostDetail[];
  realCostTotalThb: number;
  rates: ResolvedThaiCostRates;
}

/** Songkhla real costs (THB) for the month. */
export async function getSongkhlaMonthlyRealCost(
  year: number,
  month: number
): Promise<SongkhlaMonthlyCostDetail> {
  const { start, end } = getMonthDateRange(year, month);
  const ym = yearMonthKey(year, month);

  const [
    workers,
    attendanceRows,
    handlingRows,
    roster,
    rates,
    tripRows,
    drivers,
    rentedTrips,
  ] = await Promise.all([
    prisma.thaiMonthlyWorker.findMany({
      where: { station: "SONGKHLA", active: true },
      orderBy: { name: "asc" },
    }),
    prisma.thaiDailyLaborAttendance.findMany({
      where: { station: "SONGKHLA", date: { gte: start, lte: end } },
    }),
    prisma.songkhlaCrateHandlingDaily.findMany({
      where: { date: { gte: start, lte: end } },
    }),
    prisma.thaiDailyLaborMonthlyRoster.findUnique({
      where: { yearMonth_station: { yearMonth: ym, station: "SONGKHLA" } },
    }),
    resolveThaiCostRatesForMonth(year, month),
    prisma.thaiDriverTripDaily.findMany({
      where: { date: { gte: start, lte: end } },
    }),
    prisma.thaiDriver.findMany({ where: { active: true } }),
    prisma.thaiRentedVehicleTrip.findMany({
      where: {
        station: "SONGKHLA",
        date: { gte: start, lte: end },
      },
    }),
  ]);

  const monthlyWorkers = workers.map((w) => {
    const monthlyWage = decimalToNumber(w.monthlyWage) ?? 0;
    const lunchAllowance = decimalToNumber(w.lunchAllowance) ?? 0;
    const fuelAllowance = decimalToNumber(w.fuelAllowance) ?? 0;
    const rentRoomAllowance = decimalToNumber(w.rentRoomAllowance) ?? 0;
    return {
      id: w.id,
      name: w.name,
      monthlyWage,
      lunchAllowance,
      fuelAllowance,
      rentRoomAllowance,
      totalThb: computeMonthlyWorkerTotal({
        monthlyWage,
        lunchAllowance,
        fuelAllowance,
        rentRoomAllowance,
      }),
    };
  });

  const monthlyWageTotalThb = monthlyWorkers.reduce((s, w) => s + w.monthlyWage, 0);
  const monthlyLunchTotalThb = monthlyWorkers.reduce(
    (s, w) => s + w.lunchAllowance,
    0
  );
  const monthlyFuelTotalThb = monthlyWorkers.reduce(
    (s, w) => s + w.fuelAllowance,
    0
  );
  const monthlyRentRoomTotalThb = monthlyWorkers.reduce(
    (s, w) => s + w.rentRoomAllowance,
    0
  );

  const dailyLaborWageTotalThb = attendanceRows.reduce((sum, row) => {
    return (
      sum +
      computeDailyLaborDayCost({
        attendanceCount: row.attendanceCount,
        dailyWage: decimalToNumber(row.dailyWage) ?? 0,
        totalWagePaid: decimalToNumber(row.totalWagePaid),
      })
    );
  }, 0);

  // Songkhla daily labor has no LUNCH/FUEL/RENT ROOM (clerk records wage total only).
  const dailyLaborRosterCount = roster?.rosterCount ?? 0;
  const dailyLaborLunchTotalThb = 0;

  let handlingSmallCommissionThb = 0;
  let handlingLargeCommissionThb = 0;
  let handlingBoxCommissionThb = 0;
  // Songkhla has no holiday/OT rates — always weekday (small 3 / large 4).
  for (const row of handlingRows) {
    const commission = computeSadaoHandlingCommission(
      {
        smallCrateTotalQty: row.smallCrateTotalQty,
        largeCrateTotalQty: row.largeCrateTotalQty,
        boxTotalQty: row.boxTotalQty,
        smallCrateNoCheckQty: 0,
        largeCrateNoCheckQty: 0,
        boxNoCheckQty: 0,
      },
      { holidayRate: false, rateConfig: rates }
    );
    handlingSmallCommissionThb += commission.smallCommissionThb;
    handlingLargeCommissionThb += commission.largeCommissionThb;
    handlingBoxCommissionThb += commission.boxCommissionThb;
  }

  const laborSummary = sumSadaoMonthlyCost({
    monthlyWageTotalThb,
    monthlyLunchTotalThb,
    monthlyFuelTotalThb,
    monthlyRentRoomTotalThb,
    dailyLaborWageTotalThb,
    dailyLaborLunchTotalThb,
    handlingSmallCommissionThb,
    handlingLargeCommissionThb,
    handlingBoxCommissionThb,
  });

  // Driver costs: trip commission for Songkhla trips; base wage pro-rated by trip share
  const tripsByDriver = new Map<
    string,
    { songkhla: number; pattani: number }
  >();
  for (const t of tripRows) {
    const cur = tripsByDriver.get(t.driverId) ?? { songkhla: 0, pattani: 0 };
    cur.songkhla += t.songkhlaTripCount;
    cur.pattani += t.pattaniTripCount;
    tripsByDriver.set(t.driverId, cur);
  }

  const driverDetails: SongkhlaDriverCostDetail[] = [];
  let driverBaseWageAllocatedThb = 0;
  let driverTripCommissionThb = 0;

  for (const d of drivers) {
    const trips = tripsByDriver.get(d.id) ?? { songkhla: 0, pattani: 0 };
    const totalTrips = trips.songkhla + trips.pattani;
    const baseWage = decimalToNumber(d.baseWage) ?? 0;
    const share = totalTrips > 0 ? trips.songkhla / totalTrips : 0;
    const baseWageAllocatedThb = Math.round(baseWage * share * 100) / 100;
    // Only Songkhla trip commission counts toward Songkhla P&L
    const songkhlaTripCommission = trips.songkhla * rates.driverTripSongkhla;

    driverBaseWageAllocatedThb += baseWageAllocatedThb;
    driverTripCommissionThb += songkhlaTripCommission;

    if (trips.songkhla > 0 || trips.pattani > 0) {
      driverDetails.push({
        driverId: d.id,
        name: d.name,
        baseWage,
        baseWageAllocatedThb,
        songkhlaTrips: trips.songkhla,
        pattaniTrips: trips.pattani,
        tripCommissionThb: songkhlaTripCommission,
      });
    }
  }

  const driverTotalThb =
    driverBaseWageAllocatedThb + driverTripCommissionThb;
  const rentedVehicleCostThb = rentedTrips.reduce(
    (s, t) => s + (decimalToNumber(t.tripCost) ?? 0),
    0
  );
  const realCostTotalThb =
    laborSummary.totalCostThb + driverTotalThb + rentedVehicleCostThb;

  return {
    year,
    month,
    ...laborSummary,
    monthlyWorkers,
    dailyLaborRosterCount,
    attendanceDays: attendanceRows.length,
    handlingDays: handlingRows.length,
    driverBaseWageAllocatedThb,
    driverTripCommissionThb,
    driverTotalThb,
    rentedVehicleCostThb,
    drivers: driverDetails,
    realCostTotalThb,
    rates,
  };
}
