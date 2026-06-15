"use server";

import { revalidatePath } from "next/cache";
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
import { aggregateLkimMaqisCost } from "@/lib/operations-lkim-maqis";
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
    lkimMaqis,
    exchangeRateRow,
  ] = await Promise.all([
    aggregateIncome(input.year, input.month),
    aggregateMcThirdParty(input.year, input.month),
    aggregateFleetPayroll(input.year, input.month),
    aggregateOperationsCosts(input.year, input.month),
    aggregateLkimMaqisCost(input.year, input.month),
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
      lkimMaqisFee: lkimMaqis.amountMyr,
      lkimMaqisTotalCrates: lkimMaqis.totalCrates,
      lkimMaqisRatePerCrate: lkimMaqis.ratePerCrate,
    },
  });
}

/** @deprecated LKIM-MAQIS is now auto-calculated from global_cost_settings */
export async function saveOperationsMonthlyCosts(_input: {
  year: number;
  month: number;
  lkimMaqisFee?: number | null;
}) {
  await requireOperationsAccess();
  revalidatePath("/operations");
}
