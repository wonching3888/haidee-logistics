import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import { yearMonthKey } from "@/lib/constants/thai-cost";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import {
  getSongkhlaMonthlyRealCost,
  type SongkhlaMonthlyCostDetail,
} from "@/lib/thai-cost/songkhla-cost-service";
import { getSegmentInternalCostSnapshot } from "@/lib/thai-cost/segment-internal-cost";

export interface SongkhlaPnlDetail {
  year: number;
  month: number;
  internalCostMyr: number | null;
  internalCostLocked: boolean;
  exchangeRate: number;
  realCostThb: number;
  realCostMyr: number;
  pnlMyr: number | null;
  real: SongkhlaMonthlyCostDetail;
  ratesUsedSnapshot: unknown | null;
}

export async function getSongkhlaPnl(
  year: number,
  month: number
): Promise<SongkhlaPnlDetail> {
  const ym = yearMonthKey(year, month);
  const [real, segmentSnap, exchangeRateRow] = await Promise.all([
    getSongkhlaMonthlyRealCost(year, month),
    getSegmentInternalCostSnapshot(year, month, "SONGKHLA"),
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
    ratesUsedSnapshot: segmentSnap?.ratesUsedSnapshot ?? null,
  };
}
