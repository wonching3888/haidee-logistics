/**
 * Single-day Thai cost overview — three independent sections (Sadao / Songkhla / Pattani).
 * Does NOT merge cross-station P&L.
 */
import { parseDateInput, toDateInputValue } from "@/lib/date-utils";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import {
  buildPublicHolidayKeySet,
  isHolidayRate,
} from "@/lib/thai-cost/holiday";
import {
  computeDailyLaborDayCost,
  computeSadaoHandlingCommission,
} from "@/lib/thai-cost/sadao-cost";
import { computeSongkhlaHandlingCommission } from "@/lib/thai-cost/songkhla-handling-cost";
import {
  computeSadaoHandlingDayTotalThb,
  sumSadaoHandlingOtherExpensesThb,
} from "@/lib/thai-cost/sadao-handling-expenses";
import { computePattaniHandlingCosts } from "@/lib/thai-cost/pattani-handling-cost";
import {
  resolveThaiCostRatesForMonth,
} from "@/lib/thai-cost/rate-settings";
import {
  computeVehicleTripPl,
  loadVehiclePlContext,
  sumVehiclePlRows,
  type VehicleTripPlRow,
} from "@/lib/thai-cost/vehicle-pl";

export interface DailyOverviewSadaoSection {
  billableSmall: number;
  billableLarge: number;
  billableBox: number;
  commissionThb: number;
  otherExpensesThb: number;
  dayTotalThb: number;
  holidayRate: boolean;
}

export interface DailyOverviewStationSection {
  handlingCommissionThb: number;
  /** Pattani only */
  contractorThb?: number;
  sakriCommissionThb?: number;
  vehicleTrips: VehicleTripPlRow[];
  vehiclePlTotals: { incomeThb: number; costThb: number; profitThb: number };
  driverTripCommissionThb: number;
  driverTrips: Array<{
    driverName: string;
    tripCount: number;
    commissionThb: number;
  }>;
  /** Daily labor wage for this station (attendance) */
  dailyLaborWageThb: number;
  realCostTotalThb: number;
}

export interface DailyOverviewDetail {
  date: string;
  sadao: DailyOverviewSadaoSection | null;
  songkhla: DailyOverviewStationSection | null;
  pattani: DailyOverviewStationSection | null;
}

function parseRentedDriverName(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/RENTED:([^;]+)/);
  return match ? match[1].trim() : null;
}

export async function getDailyOverview(
  dateInput: string
): Promise<DailyOverviewDetail> {
  const date = parseDateInput(dateInput);
  const dateStr = toDateInputValue(date);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  const [
    sadaoHandling,
    songkhlaHandling,
    pattaniHandling,
    songkhlaAttendance,
    pattaniAttendance,
    driverTrips,
    vehicleTrips,
    holiday,
    rates,
    plCtx,
  ] = await Promise.all([
    prisma.sadaoCrateHandlingDaily.findUnique({
      where: { date },
      include: { otherExpenses: true },
    }),
    prisma.songkhlaCrateHandlingDaily.findUnique({ where: { date } }),
    prisma.pattaniCrateHandlingDaily.findUnique({ where: { date } }),
    prisma.thaiDailyLaborAttendance.findUnique({
      where: { date_station: { date, station: "SONGKHLA" } },
    }),
    prisma.thaiDailyLaborAttendance.findUnique({
      where: { date_station: { date, station: "PATTANI" } },
    }),
    prisma.thaiDriverTripDaily.findMany({
      where: { date },
      include: { driver: { select: { name: true, baseWage: true } } },
    }),
    prisma.thaiVehicleTripDaily.findMany({
      where: { date },
      include: { driver: { select: { name: true } } },
      orderBy: [{ station: "asc" }, { truckPlate: "asc" }],
    }),
    prisma.thaiPublicHoliday.findUnique({
      where: { date },
      select: { date: true },
    }),
    resolveThaiCostRatesForMonth(year, month),
    loadVehiclePlContext(year, month),
  ]);

  const holidayKeys = buildPublicHolidayKeySet(holiday ? [holiday] : []);
  const sadaoHolidayRate = isHolidayRate(date, holidayKeys);

  let sadao: DailyOverviewSadaoSection | null = null;
  if (sadaoHandling) {
    const c = computeSadaoHandlingCommission(sadaoHandling, {
      holidayRate: sadaoHolidayRate,
      rateConfig: rates,
    });
    const otherExpensesThb = sumSadaoHandlingOtherExpensesThb(
      sadaoHandling.otherExpenses.map((row) => ({
        amountThb: decimalToNumber(row.amountThb) ?? 0,
      }))
    );
    sadao = {
      billableSmall: c.smallBillableQty,
      billableLarge: c.largeBillableQty,
      billableBox: c.boxBillableQty,
      commissionThb: c.totalCommissionThb,
      otherExpensesThb,
      dayTotalThb: computeSadaoHandlingDayTotalThb(
        c.totalCommissionThb,
        otherExpensesThb
      ),
      holidayRate: sadaoHolidayRate,
    };
  }

  function buildStationSection(
    station: "SONGKHLA" | "PATTANI",
    handling:
      | typeof songkhlaHandling
      | typeof pattaniHandling
      | null,
    attendance: typeof songkhlaAttendance | null
  ): DailyOverviewStationSection | null {
    const stationVehicleTrips = vehicleTrips.filter((v) => v.station === station);
    const hasHandling = handling != null;
    const hasVehicles = stationVehicleTrips.length > 0;
    const hasDrivers = driverTrips.some((d) =>
      station === "SONGKHLA"
        ? d.songkhlaTripCount > 0
        : d.pattaniTripCount > 0
    );
    const hasAttendance = attendance != null;

    if (!hasHandling && !hasVehicles && !hasDrivers && !hasAttendance) {
      return null;
    }

    let handlingCommissionThb = 0;
    let contractorThb: number | undefined;
    let sakriCommissionThb: number | undefined;

    if (station === "SONGKHLA" && songkhlaHandling) {
      const c = computeSongkhlaHandlingCommission(
        {
          smallCrateTotalQty: songkhlaHandling.smallCrateTotalQty,
          largeCrateTotalQty: songkhlaHandling.largeCrateTotalQty,
          boxTotalQty: songkhlaHandling.boxTotalQty,
          smallCrateNoCheckQty: songkhlaHandling.smallCrateNoCheckQty ?? 0,
          largeCrateNoCheckQty: songkhlaHandling.largeCrateNoCheckQty ?? 0,
          boxNoCheckQty: songkhlaHandling.boxNoCheckQty ?? 0,
        },
        { rateConfig: rates }
      );
      handlingCommissionThb = c.totalCommissionThb;
    } else if (station === "PATTANI" && pattaniHandling) {
      const day = computePattaniHandlingCosts(
        {
          crateQty: pattaniHandling.crateQty,
          boxQty: pattaniHandling.boxQty,
          crateNoCheckQty: pattaniHandling.crateNoCheckQty ?? 0,
          boxNoCheckQty: pattaniHandling.boxNoCheckQty ?? 0,
        },
        rates
      );
      contractorThb = day.contractorThb;
      sakriCommissionThb = day.sakriCommissionThb;
      handlingCommissionThb = day.dayTotalThb;
    }

    const plRows: VehicleTripPlRow[] = stationVehicleTrips.map((v) => {
      const rentedName = parseRentedDriverName(v.notes);
      const driverName =
        v.driver?.name ?? (rentedName ? `RENTED:${rentedName}` : null);
      return computeVehicleTripPl(
        {
          id: v.id,
          date: dateStr,
          truckPlate: v.truckPlate,
          driverName,
          station,
          tongQty: v.tongQty,
          boxQty: v.boxQty,
          notes: v.notes,
        },
        plCtx
      );
    });

    const vehiclePlTotals = sumVehiclePlRows(plRows);

    const driverTripList: DailyOverviewStationSection["driverTrips"] = [];
    let driverTripCommissionThb = 0;
    for (const d of driverTrips) {
      const count =
        station === "SONGKHLA" ? d.songkhlaTripCount : d.pattaniTripCount;
      if (count <= 0) continue;
      const commission =
        count *
        (station === "SONGKHLA"
          ? rates.driverTripSongkhla
          : rates.driverTripPattani);
      driverTripCommissionThb += commission;
      driverTripList.push({
        driverName: d.driver.name,
        tripCount: count,
        commissionThb: commission,
      });
    }

    const dailyLaborWageThb = attendance
      ? computeDailyLaborDayCost({
          attendanceCount: attendance.attendanceCount,
          dailyWage: decimalToNumber(attendance.dailyWage) ?? 0,
          totalWagePaid: decimalToNumber(attendance.totalWagePaid),
        })
      : 0;

    const rentedVehicleCostThb = plRows
      .filter((r) => r.isRented)
      .reduce((s, r) => s + r.costThb, 0);
    const ownedVehicleCostThb = plRows
      .filter((r) => !r.isRented)
      .reduce((s, r) => s + r.costThb, 0);

    const realCostTotalThb =
      Math.round(
        (handlingCommissionThb +
          driverTripCommissionThb +
          dailyLaborWageThb +
          rentedVehicleCostThb +
          ownedVehicleCostThb) *
          100
      ) / 100;

    return {
      handlingCommissionThb,
      contractorThb,
      sakriCommissionThb,
      vehicleTrips: plRows,
      vehiclePlTotals,
      driverTripCommissionThb,
      driverTrips: driverTripList,
      dailyLaborWageThb,
      realCostTotalThb,
    };
  }

  return {
    date: dateStr,
    sadao,
    songkhla: buildStationSection("SONGKHLA", songkhlaHandling, songkhlaAttendance),
    pattani: buildStationSection("PATTANI", pattaniHandling, pattaniAttendance),
  };
}
