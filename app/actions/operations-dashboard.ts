"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canViewOperationsDashboard } from "@/lib/auth-roles";
import type { UserRole } from "@/types";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import { decimalToNumber } from "@/lib/freight-rates";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { buildPayrollSummary } from "@/lib/payroll-statutory";
import type { MaritalStatus } from "@/lib/constants/payroll";
import { aggregateOperationsCosts } from "@/lib/operations-cost";
import { aggregateOperationsIncome } from "@/lib/operations-income";
import {
  buildOperationsDashboardMetrics,
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

function isMissingOperationsCostsTable(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2022";
  }
  if (error instanceof Error) {
    return error.message.includes("operations_monthly_costs");
  }
  return false;
}

async function aggregateIncome(year: number, month: number) {
  const income = await aggregateOperationsIncome(year, month);
  return {
    mode1aThb: income.mode1aThb,
    mode1bMyr: income.mode1bMyr,
    mode2Myr: income.mode2Myr,
    wtlMode3Myr: income.wtlMode3Myr,
    missingRateLineCount: income.missingRateLineCount,
    missingRateQuantity: income.missingRateQuantity,
    gapReasons: income.gapReasons,
    warningSamples: income.warningSamples,
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

async function loadLkimMaqisFee(yearMonth: string) {
  try {
    const row = await prisma.operationsMonthlyCosts.findUnique({
      where: { yearMonth },
    });
    return decimalToNumber(row?.lkimMaqisFee) ?? 0;
  } catch (error) {
    if (isMissingOperationsCostsTable(error)) {
      return 0;
    }
    throw error;
  }
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
    tripCosts,
    lkimMaqisFee,
    exchangeRateRow,
  ] = await Promise.all([
    aggregateIncome(input.year, input.month),
    aggregateMcThirdParty(input.year, input.month),
    aggregateFleetPayroll(yearMonth),
    aggregateOperationsCosts(input.year, input.month),
    loadLkimMaqisFee(yearMonth),
    prisma.exchangeRate.findUnique({ where: { yearMonth } }),
  ]);

  const exchangeRate =
    decimalToNumber(exchangeRateRow?.rate) ?? DEFAULT_EXCHANGE_RATE;

  return buildOperationsDashboardMetrics({
    year: input.year,
    month: input.month,
    yearMonth,
    exchangeRate,
    exchangeRateMissing: !exchangeRateRow,
    income,
    payrollNetMyr: payroll.netMyr,
    payrollHasRecords: payroll.hasRecords,
    mcThirdPartyMyr,
    tripCosts,
    manualCosts: {
      lkimMaqisFee,
    },
  });
}

export async function saveOperationsMonthlyCosts(input: {
  year: number;
  month: number;
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

  try {
    await prisma.operationsMonthlyCosts.upsert({
      where: { yearMonth },
      create: {
        yearMonth,
        lkimMaqisFee: parseCost(input.lkimMaqisFee),
      },
      update: {
        lkimMaqisFee: parseCost(input.lkimMaqisFee),
      },
    });
  } catch (error) {
    if (isMissingOperationsCostsTable(error)) {
      throw new Error(
        "operations_monthly_costs 表未创建，请运行 npx prisma db push 或 node scripts/migrate-operations-monthly-costs.mjs"
      );
    }
    throw error;
  }

  revalidatePath("/operations");
}
