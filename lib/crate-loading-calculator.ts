import { type TruckSize } from "@/lib/driver-expense/constants";

export interface CrateLoadingRateConfigInput {
  market: string;
  smallTruck: number;
  largeTruck: number;
}

export interface CrateLoadingMarketInput {
  market: string;
}

export interface CrateLoadingFeeCalcResult {
  market: string;
  truckSize: TruckSize;
  loadingFee: number;
}

export const DEFAULT_CRATE_LOADING_RATES: CrateLoadingRateConfigInput[] = [
  { market: "KL", smallTruck: 20, largeTruck: 20 },
  { market: "BM", smallTruck: 30, largeTruck: 30 },
  { market: "A", smallTruck: 20, largeTruck: 20 },
  { market: "MC", smallTruck: 35, largeTruck: 60 },
  { market: "BP", smallTruck: 60, largeTruck: 60 },
  { market: "KD", smallTruck: 30, largeTruck: 30 },
];

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateTripCrateLoadingFees(input: {
  markets: CrateLoadingMarketInput[];
  ratesByMarket: Map<string, CrateLoadingRateConfigInput>;
  truckSize: TruckSize;
}): CrateLoadingFeeCalcResult[] {
  const seen = new Set<string>();
  const results: CrateLoadingFeeCalcResult[] = [];

  for (const row of input.markets) {
    const market = row.market.trim().toUpperCase();
    if (!market || seen.has(market)) continue;
    seen.add(market);

    const rate = input.ratesByMarket.get(market);
    if (!rate) continue;

    const loadingFee = roundMoney(
      input.truckSize === "small" ? rate.smallTruck : rate.largeTruck
    );

    results.push({
      market,
      truckSize: input.truckSize,
      loadingFee,
    });
  }

  return results;
}

export function effectiveLoadingFee(row: {
  loadingFee: number;
  loadingFeeOverride: number | null;
}) {
  return row.loadingFeeOverride ?? row.loadingFee;
}
