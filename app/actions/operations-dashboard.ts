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
import { loadFleetPayrollAggregate } from "@/lib/payroll-fleet";
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

async function aggregateFleetPayroll(year: number, month: number) {
  const payroll = await loadFleetPayrollAggregate(year, month);
  return {
    netMyr: payroll.netMyr,
    employerMyr: payroll.employerMyr,
    totalMyr: payroll.totalCostMyr,
    hasRecords: payroll.hasRecords,
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
    aggregateFleetPayroll(input.year, input.month),
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
    payroll,
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
