"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canViewPnlOperations } from "@/lib/auth-roles";
import type { UserRole } from "@/types";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import { decimalToNumber } from "@/lib/freight-rates";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { loadFleetPayrollAggregate } from "@/lib/payroll-fleet";
import { aggregateOperationsCosts } from "@/lib/operations-cost";
import { aggregateOperationsIncome } from "@/lib/operations-income";
import { aggregateLkimMaqisCost } from "@/lib/operations-lkim-maqis";
import { aggregateThaiSegmentFreightCost } from "@/lib/operations-thai-segment";
import { fetchOperationsAssignedInboundLines } from "@/lib/operations-inbound-lines";
import { listGlobalCostSettings } from "@/lib/global-cost-settings-service";
import {
  aggregateCharterOperationsCosts,
  aggregateCharterOperationsIncome,
} from "@/lib/charter-operations";
import {
  buildOperationsDashboardMetrics,
  type OperationsDashboardData,
} from "@/lib/operations-dashboard";
import { aggregateOperationsPayrollWarnings } from "@/lib/operations-payroll-warnings";
import { lineMcThirdPartyHaulageMyr } from "@/lib/mc-dispatch-delivery";

async function requireOperationsAccess() {
  const user = await getCurrentUser();
  if (!user || !canViewPnlOperations(user.role as UserRole)) {
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

async function aggregateIncome(
  year: number,
  month: number,
  inboundLines?: Awaited<ReturnType<typeof fetchOperationsAssignedInboundLines>>
) {
  const [income, charterIncome] = await Promise.all([
    aggregateOperationsIncome(year, month, inboundLines),
    aggregateCharterOperationsIncome(year, month),
  ]);
  return {
    mode1aThb: income.mode1aThb,
    mode1aMyr: income.mode1aMyr,
    mode1bMyr: income.mode1bMyr,
    mode2Myr: income.mode2Myr,
    wtlMode3Myr: income.wtlMode3Myr,
    wtlShipperMyr: income.wtlShipperMyr,
    partnerFreightMyr: income.partnerFreightMyr,
    crateReturnIncomeMyr: income.crateReturnIncomeMyr,
    monthlyInvoiceExtraChargesMyr: income.monthlyInvoiceExtraChargesMyr,
    charterRevenueMyr: charterIncome.charterRevenueMyr,
    missingRateLineCount: income.missingRateLineCount,
    missingRateQuantity: income.missingRateQuantity,
    gapReasons: income.gapReasons,
    warningSamples: income.warningSamples,
    charterIncome,
  };
}

async function aggregateMcThirdParty(year: number, month: number) {
  const { start, end } = getMonthDateRange(year, month);

  const lines = await prisma.inboundLine.findMany({
    where: {
      dispatchStatus: "assigned",
      mcDeliveryMode: "third_party",
      dispatchLines: {
        some: {
          dispatchOrder: {
            status: { notIn: ["draft", "cancelled"] },
            date: { gte: start, lte: end },
          },
        },
      },
    },
    select: { thirdPartyFee: true, mcDeliveryMode: true },
  });

  return roundMoney(
    lines.reduce((sum, line) => sum + lineMcThirdPartyHaulageMyr(line), 0)
  );
}

async function aggregateFleetPayroll(year: number, month: number) {
  const payroll = await loadFleetPayrollAggregate(year, month, { sync: false });
  return {
    netMyr: payroll.netMyr,
    employerMyr: payroll.employerMyr,
    totalMyr: payroll.totalCostMyr,
    hasRecords: payroll.hasRecords,
  };
}

async function loadGlobalCostRates() {
  const rows = await listGlobalCostSettings();
  const byKey = new Map(rows.map((row) => [row.key, row.valueMyr]));
  return {
    epermit: byKey.get("epermit") ?? 0,
    dagangNet: byKey.get("dagang_net") ?? 0,
    forwardingOutbound: byKey.get("forwarding_outbound") ?? 0,
    forwardingReturn: byKey.get("forwarding_return") ?? 0,
    lkimPerCrate: byKey.get("lkim_maqis_per_crate") ?? 0,
    lkimPerBox: byKey.get("lkim_maqis_per_box") ?? 0,
  };
}

export async function getOperationsDashboard(input: {
  year: number;
  month: number;
}): Promise<OperationsDashboardData> {
  await requireOperationsAccess();
  const yearMonth = parseYearMonth(input.year, input.month);

  const inboundLines = await fetchOperationsAssignedInboundLines(
    input.year,
    input.month
  );

  const [
    income,
    mcThirdPartyMyr,
    payroll,
    tripCosts,
    lkimMaqis,
    thaiSegmentFreight,
    exchangeRateRow,
    globalCostRates,
    charterCosts,
    payrollWarning,
  ] = await Promise.all([
    aggregateIncome(input.year, input.month, inboundLines),
    aggregateMcThirdParty(input.year, input.month),
    aggregateFleetPayroll(input.year, input.month),
    aggregateOperationsCosts(input.year, input.month),
    aggregateLkimMaqisCost(input.year, input.month, inboundLines),
    aggregateThaiSegmentFreightCost(input.year, input.month, inboundLines),
    prisma.exchangeRate.findUnique({ where: { yearMonth } }),
    loadGlobalCostRates(),
    aggregateCharterOperationsCosts(input.year, input.month),
    aggregateOperationsPayrollWarnings(input.year, input.month),
  ]);

  const exchangeRate =
    decimalToNumber(exchangeRateRow?.rate) ?? DEFAULT_EXCHANGE_RATE;

  return {
    ...buildOperationsDashboardMetrics({
      year: input.year,
      month: input.month,
      yearMonth,
      exchangeRate,
      exchangeRateMissing: !exchangeRateRow,
      income,
      payroll,
      mcThirdPartyMyr,
      tripCosts,
      lkimMaqis,
      thaiSegmentFreight,
      globalCostRates,
      charter: {
        income: income.charterIncome,
        costs: charterCosts,
      },
    }),
    payrollWarning: payrollWarning.showBox ? payrollWarning : null,
  };
}
