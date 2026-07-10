import {
  SONGKHLA_HANDLING_BOX_RATE_THB,
  SONGKHLA_HANDLING_CRATE_RATE_THB,
} from "@/lib/constants/thai-cost";
import {
  computeSadaoHandlingCommission,
  type SadaoHandlingQtyInput,
} from "@/lib/thai-cost/sadao-cost";
import type { ResolvedThaiCostRates, ThaiCostRates } from "@/lib/thai-cost/rate-settings";

export interface SongkhlaHandlingRates {
  crate: number;
  box: number;
}

/** Effective totals used for billing (already resolved: live dispatch or locked manual). */
export interface SongkhlaHandlingQtyInput {
  smallCrateTotalQty: number;
  largeCrateTotalQty: number;
  boxTotalQty: number;
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
  return {
    crateBillableQty: legacy.smallBillableQty + legacy.largeBillableQty,
    boxBillableQty: legacy.boxBillableQty,
    rates: { crate: 0, box: legacy.rates.box },
    crateCommissionThb: roundMoney(
      legacy.smallCommissionThb + legacy.largeCommissionThb
    ),
    boxCommissionThb: roundMoney(legacy.boxCommissionThb),
    totalCommissionThb: roundMoney(legacy.totalCommissionThb),
  };
}

/**
 * Songkhla daily handling commission from effective totals.
 * Billable crates = small + large; billable boxes = box (no separate override).
 */
export function computeSongkhlaHandlingCommission(
  input: SongkhlaHandlingQtyInput,
  options: { rateConfig?: ThaiCostRates | ResolvedThaiCostRates } = {}
): SongkhlaHandlingCommission {
  const asSadao: SadaoHandlingQtyInput = {
    smallCrateTotalQty: input.smallCrateTotalQty,
    largeCrateTotalQty: input.largeCrateTotalQty,
    boxTotalQty: input.boxTotalQty,
    smallCrateNoCheckQty: 0,
    largeCrateNoCheckQty: 0,
    boxNoCheckQty: 0,
  };

  if (usesSongkhlaLegacyBilling(options.rateConfig)) {
    return fromLegacySadaoCommission(
      computeSadaoHandlingCommission(asSadao, {
        holidayRate: false,
        rateConfig: options.rateConfig,
      })
    );
  }

  const crateBillableQty =
    input.smallCrateTotalQty + input.largeCrateTotalQty;
  const boxBillableQty = input.boxTotalQty;
  const rates = options.rateConfig
    ? songkhlaHandlingRatesFromConfig(options.rateConfig)
    : {
        crate: SONGKHLA_HANDLING_CRATE_RATE_THB,
        box: SONGKHLA_HANDLING_BOX_RATE_THB,
      };
  const crateCommissionThb = roundMoney(crateBillableQty * rates.crate);
  const boxCommissionThb = roundMoney(boxBillableQty * rates.box);
  return {
    crateBillableQty,
    boxBillableQty,
    rates,
    crateCommissionThb,
    boxCommissionThb,
    totalCommissionThb: roundMoney(crateCommissionThb + boxCommissionThb),
  };
}
