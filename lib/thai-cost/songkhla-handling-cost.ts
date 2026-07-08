import {
  SONGKHLA_HANDLING_BOX_RATE_THB,
  SONGKHLA_HANDLING_CRATE_RATE_THB,
} from "@/lib/constants/thai-cost";
import {
  computeSadaoBillableCrates,
  computeSadaoHandlingCommission,
  type SadaoHandlingQtyInput,
} from "@/lib/thai-cost/sadao-cost";
import type { ResolvedThaiCostRates, ThaiCostRates } from "@/lib/thai-cost/rate-settings";

export interface SongkhlaHandlingRates {
  crate: number;
  box: number;
}

export interface SongkhlaHandlingCommission {
  crateBillableQty: number;
  boxBillableQty: number;
  rates: SongkhlaHandlingRates;
  crateCommissionThb: number;
  boxCommissionThb: number;
  totalCommissionThb: number;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function songkhlaHandlingRatesFromConfig(
  rates: Pick<ThaiCostRates, "songkhlaCrateRate" | "songkhlaBoxRate">
): SongkhlaHandlingRates {
  return {
    crate: rates.songkhlaCrateRate,
    box: rates.songkhlaBoxRate,
  };
}

function usesSongkhlaLegacyBilling(
  rateConfig?: ThaiCostRates | ResolvedThaiCostRates
): boolean {
  return (
    rateConfig != null &&
    "songkhlaHandlingLegacy" in rateConfig &&
    rateConfig.songkhlaHandlingLegacy === true
  );
}

function fromLegacySadaoCommission(
  legacy: ReturnType<typeof computeSadaoHandlingCommission>
): SongkhlaHandlingCommission {
  const crateBillableQty =
    legacy.smallBillableQty + legacy.largeBillableQty;
  const crateCommissionThb = roundMoney(
    legacy.smallCommissionThb + legacy.largeCommissionThb
  );
  return {
    crateBillableQty,
    boxBillableQty: legacy.boxBillableQty,
    rates: {
      crate: 0,
      box: legacy.rates.box,
    },
    crateCommissionThb,
    boxCommissionThb: roundMoney(legacy.boxCommissionThb),
    totalCommissionThb: roundMoney(legacy.totalCommissionThb),
  };
}

/**
 * Songkhla daily handling commission: (small + large) × crate rate + box × box rate.
 * Locked monthly snapshots without Songkhla unified rates fall back to legacy Sadao split.
 */
export function computeSongkhlaHandlingCommission(
  input: Pick<
    SadaoHandlingQtyInput,
    "smallCrateTotalQty" | "largeCrateTotalQty" | "boxTotalQty"
  >,
  options: { rateConfig?: ThaiCostRates | ResolvedThaiCostRates } = {}
): SongkhlaHandlingCommission {
  const qtyInput: SadaoHandlingQtyInput = {
    smallCrateTotalQty: input.smallCrateTotalQty,
    largeCrateTotalQty: input.largeCrateTotalQty,
    boxTotalQty: input.boxTotalQty,
    smallCrateNoCheckQty: 0,
    largeCrateNoCheckQty: 0,
    boxNoCheckQty: 0,
  };

  if (usesSongkhlaLegacyBilling(options.rateConfig)) {
    return fromLegacySadaoCommission(
      computeSadaoHandlingCommission(qtyInput, {
        holidayRate: false,
        rateConfig: options.rateConfig,
      })
    );
  }

  const billable = computeSadaoBillableCrates(qtyInput);
  const crateBillableQty =
    billable.smallBillableQty + billable.largeBillableQty;
  const rates = options.rateConfig
    ? songkhlaHandlingRatesFromConfig(options.rateConfig)
    : {
        crate: SONGKHLA_HANDLING_CRATE_RATE_THB,
        box: SONGKHLA_HANDLING_BOX_RATE_THB,
      };
  const crateCommissionThb = roundMoney(crateBillableQty * rates.crate);
  const boxCommissionThb = roundMoney(billable.boxBillableQty * rates.box);
  return {
    crateBillableQty,
    boxBillableQty: billable.boxBillableQty,
    rates,
    crateCommissionThb,
    boxCommissionThb,
    totalCommissionThb: roundMoney(crateCommissionThb + boxCommissionThb),
  };
}
