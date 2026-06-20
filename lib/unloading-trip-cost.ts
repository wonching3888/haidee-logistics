import {
  effectiveKpbFee,
  effectiveUnloadFee,
  type UnloadingRateConfigInput,
} from "@/lib/unloading-calculator";
import {
  estimateTripUnloadingFeesTotal,
  type UnloadingDispatchEstimateInput,
} from "@/lib/driver-expense-service";

export type UnloadingFeeCostRow = {
  unloadFee: number;
  unloadFeeOverride: number | null;
  kpbFee: number;
  kpbFeeOverride: number | null;
  isKpbExempt: boolean;
};

export type CrateLoadingFeeCostRow = {
  loadingFee: number;
  loadingFeeOverride: number | null;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function sumUnloadingFeeRowsEffective(
  rows: UnloadingFeeCostRow[]
): number {
  return roundMoney(
    rows.reduce(
      (sum, row) =>
        sum + effectiveUnloadFee(row) + effectiveKpbFee(row),
      0
    )
  );
}

export function sumLoadingFeeRowsEffective(
  rows: CrateLoadingFeeCostRow[]
): number {
  return roundMoney(
    rows.reduce(
      (sum, row) => sum + (row.loadingFeeOverride ?? row.loadingFee),
      0
    )
  );
}

export function resolveTripLoadUnloadCost(input: {
  unloadingRows: UnloadingFeeCostRow[];
  loadingRows: CrateLoadingFeeCostRow[];
  dispatchEstimate?: UnloadingDispatchEstimateInput | null;
  ratesByMarket?: Map<string, UnloadingRateConfigInput>;
}): number {
  let total = 0;

  if (input.unloadingRows.length > 0) {
    total += sumUnloadingFeeRowsEffective(input.unloadingRows);
  } else if (input.dispatchEstimate && input.ratesByMarket) {
    total += estimateTripUnloadingFeesTotal(
      input.dispatchEstimate,
      input.ratesByMarket
    );
  }

  if (input.loadingRows.length > 0) {
    total += sumLoadingFeeRowsEffective(input.loadingRows);
  }

  return roundMoney(total);
}
