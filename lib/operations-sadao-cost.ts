/**
 * SADAO station costs for MY operations dashboard (month-level, THB→MYR).
 * Handling commission + SADAO monthly workers only (not Songkhla/Pattani).
 */
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import { yearMonthKey } from "@/lib/constants/thai-cost";
import { convertThbToMyr, decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import { getSadaoMonthlyCost } from "@/lib/thai-cost/sadao-cost-service";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function aggregateSadaoStationCostMyr(year: number, month: number) {
  const ym = yearMonthKey(year, month);
  const [cost, fxRow] = await Promise.all([
    getSadaoMonthlyCost(year, month),
    prisma.exchangeRate.findUnique({ where: { yearMonth: ym } }),
  ]);
  const exchangeRate =
    decimalToNumber(fxRow?.rate) ?? DEFAULT_EXCHANGE_RATE;

  // handlingCommissionTotalThb already includes other expenses (see sumSadaoMonthlyCost).
  const handlingThb = cost.handlingCommissionTotalThb;
  const monthlyWorkerTotalThb = cost.monthlyWorkerTotalThb;

  const handlingMyr = roundMoney(convertThbToMyr(handlingThb, exchangeRate));
  const monthlyWorkersMyr = roundMoney(
    convertThbToMyr(monthlyWorkerTotalThb, exchangeRate)
  );

  return {
    exchangeRate,
    handlingThb,
    handlingMyr,
    monthlyWorkerTotalThb,
    monthlyWorkersMyr,
    totalAmountMyr: roundMoney(handlingMyr + monthlyWorkersMyr),
    handlingDays: cost.handlingDays,
    monthlyWorkerCount: cost.monthlyWorkers.length,
  };
}
