"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canViewOperationsDashboard } from "@/lib/auth-roles";
import type { UserRole } from "@/types";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import { DEFAULT_FUEL_PRICES } from "@/lib/constants/truck-cost";
import { decimalToNumber } from "@/lib/freight-rates";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { buildPayrollSummary } from "@/lib/payroll-statutory";
import type { MaritalStatus } from "@/lib/constants/payroll";
import {
  buildOperationsDashboardMetrics,
  estimateTruckMonthlyCosts,
  type OperationsDashboardData,
} from "@/lib/operations-dashboard";

async function requireOperationsAccess() {
  const user = await getCurrentUser();
  if (!user || !canViewOperationsDashboard(user.role as UserRole)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

function parseYearMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("无效年份 Invalid year");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("无效月份 Invalid month");
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function aggregateIncome(year: number, month: number) {
  const { start, end } = getMonthDateRange(year, month);

  const lines = await prisma.inboundLine.findMany({
    where: {
      session: {
        status: "confirmed",
        date: { gte: start, lte: end },
      },
      freightAmount: { gt: 0 },
    },
    select: {
      paymentMode: true,
      currency: true,
      freightAmount: true,
    },
  });

  let mode1aThb = 0;
  let mode1bMyr = 0;
  let mode2Myr = 0;
  let wtlMode3Myr = 0;

  for (const line of lines) {
    const amount = decimalToNumber(line.freightAmount) ?? 0;
    if (line.paymentMode === "1a") {
      mode1aThb += amount;
    } else if (line.paymentMode === "1b") {
      mode1bMyr += amount;
    } else if (line.paymentMode === "2") {
      mode2Myr += amount;
    } else if (line.paymentMode === "3") {
      wtlMode3Myr += amount;
    }
  }

  return {
    mode1aThb: roundMoney(mode1aThb),
    mode1bMyr: roundMoney(mode1bMyr),
    mode2Myr: roundMoney(mode2Myr),
    wtlMode3Myr: roundMoney(wtlMode3Myr),
  };
}

async function aggregateMcThirdParty(year: number, month: number) {
  const { start, end } = getMonthDateRange(year, month);

  const lines = await prisma.inboundLine.findMany({
    where: {
      session: {
        status: "confirmed",
        date: { gte: start, lte: end },
      },
      thirdPartyFee: { gt: 0 },
    },
    select: { thirdPartyFee: true },
  });

  return roundMoney(
    lines.reduce((sum, line) => sum + (decimalToNumber(line.thirdPartyFee) ?? 0), 0)
  );
}

async function aggregateFleetPayroll(yearMonth: string) {
  const drivers = await prisma.driver.findMany({
    where: { active: true },
    include: {
      payrollMonths: {
        where: { yearMonth },
        include: {
          trips: true,
          extras: true,
        },
      },
    },
  });

  let netTotal = 0;
  let allHaveRecords = drivers.length > 0;

  for (const driver of drivers) {
    const monthRecord = driver.payrollMonths[0];
    if (!monthRecord) {
      allHaveRecords = false;
      netTotal += decimalToNumber(driver.baseSalary) ?? 0;
      continue;
    }

    const summary = buildPayrollSummary({
      earnings: {
        baseSalary: decimalToNumber(driver.baseSalary) ?? 0,
        tripAllowanceTotal: roundMoney(
          monthRecord.trips.reduce(
            (sum, trip) => sum + (decimalToNumber(trip.tripAllowance) ?? 0),
            0
          )
        ),
        tripExtraAllowanceTotal: roundMoney(
          monthRecord.trips.reduce(
            (sum, trip) => sum + (decimalToNumber(trip.extraAllowance) ?? 0),
            0
          )
        ),
        crateCommissionTotal: roundMoney(
          monthRecord.trips.reduce(
            (sum, trip) =>
              sum + (decimalToNumber(trip.crateReturnCommission) ?? 0),
            0
          )
        ),
        extraAllowanceTotal: roundMoney(
          monthRecord.extras
            .filter((item) => item.type === "extra_allowance")
            .reduce(
              (sum, item) => sum + (decimalToNumber(item.amount) ?? 0),
              0
            )
        ),
        advanceTotal: roundMoney(
          monthRecord.extras
            .filter((item) => item.type === "advance")
            .reduce(
              (sum, item) => sum + (decimalToNumber(item.amount) ?? 0),
              0
            )
        ),
      },
      maritalStatus: driver.maritalStatus as MaritalStatus | null,
      childCount: driver.childCount,
      overrides: {
        epfEmployee: decimalToNumber(monthRecord.epfEmployeeOverride),
        epfEmployer: decimalToNumber(monthRecord.epfEmployerOverride),
        socsoEmployee: decimalToNumber(monthRecord.socsoEmployeeOverride),
        socsoEmployer: decimalToNumber(monthRecord.socsoEmployerOverride),
        eisEmployee: decimalToNumber(monthRecord.eisEmployeeOverride),
        eisEmployer: decimalToNumber(monthRecord.eisEmployerOverride),
        pcb: decimalToNumber(monthRecord.pcbOverride),
      },
    });
    netTotal += summary.netSalary;
  }

  return {
    netMyr: roundMoney(netTotal),
    hasRecords: allHaveRecords,
  };
}

async function loadManualCosts(yearMonth: string) {
  const row = await prisma.operationsMonthlyCosts.findUnique({
    where: { yearMonth },
  });
  return {
    tollFee: decimalToNumber(row?.tollFee) ?? 0,
    crateRental: decimalToNumber(row?.crateRental) ?? 0,
    loadUnloadFee: decimalToNumber(row?.loadUnloadFee) ?? 0,
    lkimMaqisFee: decimalToNumber(row?.lkimMaqisFee) ?? 0,
  };
}

export async function getOperationsDashboard(input: {
  year: number;
  month: number;
}): Promise<OperationsDashboardData> {
  await requireOperationsAccess();
  const yearMonth = parseYearMonth(input.year, input.month);

  const [
    income,
    mcThirdPartyMyr,
    payroll,
    manualCosts,
    exchangeRateRow,
    fuelPriceRow,
    trucks,
  ] = await Promise.all([
    aggregateIncome(input.year, input.month),
    aggregateMcThirdParty(input.year, input.month),
    aggregateFleetPayroll(yearMonth),
    loadManualCosts(yearMonth),
    prisma.exchangeRate.findUnique({ where: { yearMonth } }),
    prisma.fuelPrice.findUnique({ where: { id: "default" } }),
    prisma.truck.findMany({
      where: { active: true, country: "MY" },
      include: { costItems: true },
    }),
  ]);

  const exchangeRate =
    decimalToNumber(exchangeRateRow?.rate) ?? DEFAULT_EXCHANGE_RATE;
  const fuelPriceMyr =
    decimalToNumber(fuelPriceRow?.myrPerLiter) ?? DEFAULT_FUEL_PRICES.myrPerLiter;

  const truckCosts = estimateTruckMonthlyCosts({
    trucks: trucks.map((truck) => ({
      country: truck.country,
      active: truck.active,
      annualMileageKm: truck.annualMileageKm,
      fuelEfficiencyKmPerL: decimalToNumber(truck.fuelEfficiencyKmPerL),
      costItems: truck.costItems.map((item) => ({
        annualAmount: decimalToNumber(item.annualAmount) ?? 0,
      })),
    })),
    fuelPriceMyr,
  });

  return buildOperationsDashboardMetrics({
    year: input.year,
    month: input.month,
    yearMonth,
    exchangeRate,
    exchangeRateMissing: !exchangeRateRow,
    income,
    payrollNetMyr: payroll.netMyr,
    payrollHasRecords: payroll.hasRecords,
    truckFuelMyr: truckCosts.fuelMyr,
    truckMaintenanceMyr: truckCosts.maintenanceMyr,
    truckEstimateCount: truckCosts.truckCount,
    mcThirdPartyMyr,
    manualCosts,
  });
}

export async function saveOperationsMonthlyCosts(input: {
  year: number;
  month: number;
  tollFee?: number | null;
  crateRental?: number | null;
  loadUnloadFee?: number | null;
  lkimMaqisFee?: number | null;
}) {
  await requireOperationsAccess();
  const yearMonth = parseYearMonth(input.year, input.month);

  function parseCost(value: number | null | undefined) {
    if (value == null || value === undefined) return null;
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("费用不能为负数 Cost cannot be negative");
    }
    return value;
  }

  await prisma.operationsMonthlyCosts.upsert({
    where: { yearMonth },
    create: {
      yearMonth,
      tollFee: parseCost(input.tollFee),
      crateRental: parseCost(input.crateRental),
      loadUnloadFee: parseCost(input.loadUnloadFee),
      lkimMaqisFee: parseCost(input.lkimMaqisFee),
    },
    update: {
      tollFee: parseCost(input.tollFee),
      crateRental: parseCost(input.crateRental),
      loadUnloadFee: parseCost(input.loadUnloadFee),
      lkimMaqisFee: parseCost(input.lkimMaqisFee),
    },
  });

  revalidatePath("/operations");
}
