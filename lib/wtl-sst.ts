import { WTL_SST_MULTIPLIER } from "@/lib/constants/freight-settings";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export interface WtlSstSplit {
  inclusive: number;
  exTax: number;
  sst: number;
}

/**
 * Split an aggregate MY amount that already includes 6% SST.
 * Applied on summed inclusive totals (not per-line) to avoid rounding drift.
 */
export function splitWtlSst(inclusiveAmount: number): WtlSstSplit {
  if (inclusiveAmount <= 0) {
    return { inclusive: 0, exTax: 0, sst: 0 };
  }

  const inclusive = roundMoney(inclusiveAmount);
  const exTax = roundMoney(inclusive / WTL_SST_MULTIPLIER);
  const sst = roundMoney(inclusive - exTax);

  return { inclusive, exTax, sst };
}
