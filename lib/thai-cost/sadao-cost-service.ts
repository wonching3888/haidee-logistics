import {
  DEFAULT_LUNCH_ALLOWANCE_THB,
  yearMonthKey,
} from "@/lib/constants/thai-cost";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import {
  buildPublicHolidayKeySet,
  isHolidayRate,
} from "@/lib/thai-cost/holiday";
import {
  computeDailyLaborDayCost,
  computeDailyLaborLunchTotal,
  computeMonthlyWorkerTotal,
  computeSadaoHandlingCommission,
  sumSadaoMonthlyCost,
  type SadaoMonthlyCostSummary,
} from "@/lib/thai-cost/sadao-cost";
import { sumSadaoHandlingOtherExpensesThb } from "@/lib/thai-cost/sadao-handling-expenses";
import {
  resolveThaiCostRatesForMonth,
  type ResolvedThaiCostRates,
} from "@/lib/thai-cost/rate-settings";

export interface SadaoMonthlyWorkerDetail {
  id: string;
  name: string;
  monthlyWage: number;
  lunchAllowance: number;
  fuelAllowance: number;
  rentRoomAllowance: number;
  totalThb: number;
}

export interface SadaoMonthlyCostDetail extends SadaoMonthlyCostSummary {
  year: number;
  month: number;
  monthlyWorkers: SadaoMonthlyWorkerDetail[];
  dailyLaborRosterCount: number;
  attendanceDays: number;
  handlingDays: number;
  rates: ResolvedThaiCostRates;
}

/** Aggregate Sadao monthly cost including allowances, box handling, holiday rates. */
export async function getSadaoMonthlyCost(
  year: number,
  month: number
): Promise<SadaoMonthlyCostDetail> {
  const { start, end } = getMonthDateRange(year, month);
  const ym = yearMonthKey(year, month);

  const [workers, attendanceRows, handlingRows, roster, holidays, rates] =
    await Promise.all([
      prisma.thaiMonthlyWorker.findMany({
        where: { station: "SADAO", active: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          monthlyWage: true,
          lunchAllowance: true,
          fuelAllowance: true,
          rentRoomAllowance: true,
        },
      }),
      prisma.thaiDailyLaborAttendance.findMany({
        where: {
          station: "SADAO",
          date: { gte: start, lte: end },
        },
        orderBy: { date: "asc" },
      }),
      prisma.sadaoCrateHandlingDaily.findMany({
        where: { date: { gte: start, lte: end } },
        include: { otherExpenses: true },
        orderBy: { date: "asc" },
      }),
      prisma.thaiDailyLaborMonthlyRoster.findUnique({
        where: { yearMonth_station: { yearMonth: ym, station: "SADAO" } },
      }),
      prisma.thaiPublicHoliday.findMany({
        where: { date: { gte: start, lte: end } },
        select: { date: true },
      }),
      resolveThaiCostRatesForMonth(year, month),
    ]);

  const holidayKeys = buildPublicHolidayKeySet(holidays);

  const monthlyWorkers: SadaoMonthlyWorkerDetail[] = workers.map((w) => {
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

  const monthlyWageTotalThb = monthlyWorkers.reduce(
    (sum, w) => sum + w.monthlyWage,
    0
  );
  const monthlyLunchTotalThb = monthlyWorkers.reduce(
    (sum, w) => sum + w.lunchAllowance,
    0
  );
  const monthlyFuelTotalThb = monthlyWorkers.reduce(
    (sum, w) => sum + w.fuelAllowance,
    0
  );
  const monthlyRentRoomTotalThb = monthlyWorkers.reduce(
    (sum, w) => sum + w.rentRoomAllowance,
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

  const dailyLaborRosterCount = roster?.rosterCount ?? 0;
  const dailyLaborLunchTotalThb = computeDailyLaborLunchTotal(
    dailyLaborRosterCount,
    DEFAULT_LUNCH_ALLOWANCE_THB
  );

  let handlingSmallCommissionThb = 0;
  let handlingLargeCommissionThb = 0;
  let handlingBoxCommissionThb = 0;
  let handlingOtherExpensesThb = 0;
  for (const row of handlingRows) {
    const commission = computeSadaoHandlingCommission(
      {
        smallCrateTotalQty: row.smallCrateTotalQty,
        largeCrateTotalQty: row.largeCrateTotalQty,
        boxTotalQty: row.boxTotalQty,
        smallCrateNoCheckQty: row.smallCrateNoCheckQty,
        largeCrateNoCheckQty: row.largeCrateNoCheckQty,
        boxNoCheckQty: row.boxNoCheckQty,
      },
      {
        holidayRate: isHolidayRate(row.date, holidayKeys),
        rateConfig: rates,
      }
    );
    handlingSmallCommissionThb += commission.smallCommissionThb;
    handlingLargeCommissionThb += commission.largeCommissionThb;
    handlingBoxCommissionThb += commission.boxCommissionThb;
    handlingOtherExpensesThb += sumSadaoHandlingOtherExpensesThb(
      row.otherExpenses.map((expense) => ({
        amountThb: decimalToNumber(expense.amountThb) ?? 0,
      }))
    );
  }

  const summary = sumSadaoMonthlyCost({
    monthlyWageTotalThb,
    monthlyLunchTotalThb,
    monthlyFuelTotalThb,
    monthlyRentRoomTotalThb,
    dailyLaborWageTotalThb,
    dailyLaborLunchTotalThb,
    handlingSmallCommissionThb,
    handlingLargeCommissionThb,
    handlingBoxCommissionThb,
    handlingOtherExpensesThb,
  });

  return {
    year,
    month,
    ...summary,
    monthlyWorkers,
    dailyLaborRosterCount,
    attendanceDays: attendanceRows.length,
    handlingDays: handlingRows.length,
    rates,
  };
}
