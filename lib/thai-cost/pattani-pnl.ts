import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import { yearMonthKey } from "@/lib/constants/thai-cost";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import {
  getPattaniMonthlyRealCost,
  type PattaniMonthlyCostDetail,
} from "@/lib/thai-cost/pattani-cost-service";
import { getSegmentInternalCostSnapshot } from "@/lib/thai-cost/segment-internal-cost";

export interface PattaniPnlDetail {
  year: number;
  month: number;
  internalCostMyr: number | null;
  internalCostLocked: boolean;
  exchangeRate: number;
  realCostThb: number;
  realCostMyr: number;
  pnlMyr: number | null;
  real: PattaniMonthlyCostDetail;
}

export async function getPattaniPnl(
  year: number,
  month: number
): Promise<PattaniPnlDetail> {
  const ym = yearMonthKey(year, month);
  const [real, segmentSnap, exchangeRateRow] = await Promise.all([
    getPattaniMonthlyRealCost(year, month),
    getSegmentInternalCostSnapshot(year, month, "PATTANI"),
    prisma.exchangeRate.findUnique({ where: { yearMonth: ym } }),
  ]);

  const exchangeRate =
    decimalToNumber(exchangeRateRow?.rate) ?? DEFAULT_EXCHANGE_RATE;
  const realCostThb = real.realCostTotalThb;
  const realCostMyr =
    exchangeRate > 0
      ? Math.round((realCostThb / exchangeRate) * 100) / 100
      : 0;

  const internalCostMyr = segmentSnap
    ? (decimalToNumber(segmentSnap.totalAmountMyr) ?? 0)
    : null;

  const pnlMyr =
    internalCostMyr != null
      ? Math.round((internalCostMyr - realCostMyr) * 100) / 100
      : null;

  return {
    year,
    month,
    internalCostMyr,
    internalCostLocked: !!segmentSnap,
    exchangeRate,
    realCostThb,
    realCostMyr,
    pnlMyr,
    real,
  };
}
