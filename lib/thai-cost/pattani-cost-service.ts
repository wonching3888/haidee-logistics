import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { computeMonthlyWorkerTotal } from "@/lib/thai-cost/sadao-cost";
import {
  computePattaniDayCosts,
  resolveThaiCostRatesForMonth,
  type ResolvedThaiCostRates,
} from "@/lib/thai-cost/rate-settings";

export interface PattaniMonthlyCostDetail {
  year: number;
  month: number;
  sakriMonthlyWageThb: number;
  sakriCommissionThb: number;
  contractorThb: number;
  driverBaseWageAllocatedThb: number;
  driverTripCommissionThb: number;
  driverTotalThb: number;
  realCostTotalThb: number;
  handlingDays: number;
  rates: ResolvedThaiCostRates;
  workers: Array<{ id: string; name: string; monthlyWage: number; totalThb: number }>;
  drivers: Array<{
    driverId: string;
    name: string;
    baseWageAllocatedThb: number;
    pattaniTrips: number;
    tripCommissionThb: number;
  }>;
}

export async function getPattaniMonthlyRealCost(
  year: number,
  month: number
): Promise<PattaniMonthlyCostDetail> {
  const { start, end } = getMonthDateRange(year, month);

  const [workers, handlingRows, rates, tripRows, drivers] = await Promise.all([
    prisma.thaiMonthlyWorker.findMany({
      where: { station: "PATTANI", active: true },
      orderBy: { name: "asc" },
    }),
    prisma.pattaniCrateHandlingDaily.findMany({
      where: { date: { gte: start, lte: end } },
    }),
    resolveThaiCostRatesForMonth(year, month),
    prisma.thaiDriverTripDaily.findMany({
      where: { date: { gte: start, lte: end } },
    }),
    prisma.thaiDriver.findMany({ where: { active: true } }),
  ]);

  const workerDetails = workers.map((w) => {
    const monthlyWage = decimalToNumber(w.monthlyWage) ?? 0;
    const lunchAllowance = decimalToNumber(w.lunchAllowance) ?? 0;
    const fuelAllowance = decimalToNumber(w.fuelAllowance) ?? 0;
    const rentRoomAllowance = decimalToNumber(w.rentRoomAllowance) ?? 0;
    return {
      id: w.id,
      name: w.name,
      monthlyWage,
      totalThb: computeMonthlyWorkerTotal({
        monthlyWage,
        lunchAllowance,
        fuelAllowance,
        rentRoomAllowance,
      }),
    };
  });

  const sakriMonthlyWageThb = workerDetails.reduce((s, w) => s + w.totalThb, 0);

  let contractorThb = 0;
  let sakriCommissionThb = 0;
  for (const row of handlingRows) {
    const day = computePattaniDayCosts(row.crateQty, row.boxQty, rates);
    contractorThb += day.contractorThb;
    sakriCommissionThb += day.sakriCommissionThb;
  }

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

  const driverDetails: PattaniMonthlyCostDetail["drivers"] = [];
  let driverBaseWageAllocatedThb = 0;
  let driverTripCommissionThb = 0;

  for (const d of drivers) {
    const trips = tripsByDriver.get(d.id) ?? { songkhla: 0, pattani: 0 };
    const totalTrips = trips.songkhla + trips.pattani;
    const baseWage = decimalToNumber(d.baseWage) ?? 0;
    const share = totalTrips > 0 ? trips.pattani / totalTrips : 0;
    const baseWageAllocatedThb = Math.round(baseWage * share * 100) / 100;
    const tripCommissionThb = trips.pattani * rates.driverTripPattani;

    driverBaseWageAllocatedThb += baseWageAllocatedThb;
    driverTripCommissionThb += tripCommissionThb;

    if (trips.pattani > 0 || trips.songkhla > 0) {
      driverDetails.push({
        driverId: d.id,
        name: d.name,
        baseWageAllocatedThb,
        pattaniTrips: trips.pattani,
        tripCommissionThb,
      });
    }
  }

  const driverTotalThb =
    driverBaseWageAllocatedThb + driverTripCommissionThb;
  const realCostTotalThb =
    sakriMonthlyWageThb +
    sakriCommissionThb +
    contractorThb +
    driverTotalThb;

  return {
    year,
    month,
    sakriMonthlyWageThb,
    sakriCommissionThb,
    contractorThb,
    driverBaseWageAllocatedThb,
    driverTripCommissionThb,
    driverTotalThb,
    realCostTotalThb,
    handlingDays: handlingRows.length,
    rates,
    workers: workerDetails,
    drivers: driverDetails,
  };
}
