import {
  computeSadaoBillableCrates,
  type SadaoHandlingQtyInput,
} from "@/lib/thai-cost/sadao-cost";

export interface PattaniDayCostRates {
  pattaniContractorCrate: number;
  pattaniContractorBox: number;
  pattaniSakriCrate: number;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/** Pure Pattani contractor + SAKRI day costs from billable qty (no DB). */
export function computePattaniDayCosts(
  crateQty: number,
  boxQty: number,
  rates: PattaniDayCostRates
) {
  const contractorThb = roundMoney(
    crateQty * rates.pattaniContractorCrate +
      boxQty * rates.pattaniContractorBox
  );
  const sakriCommissionThb = roundMoney(crateQty * rates.pattaniSakriCrate);
  return {
    contractorThb,
    sakriCommissionThb,
    dayTotalThb: roundMoney(contractorThb + sakriCommissionThb),
  };
}

export interface PattaniHandlingQtyInput {
  crateQty: number;
  boxQty: number;
  crateNoCheckQty: number;
  boxNoCheckQty: number;
}

export interface PattaniBillableCrates {
  crateBillableQty: number;
  boxBillableQty: number;
}

/** Billable crate/box = total − direct; reuses Sadao per-category validation. */
export function computePattaniBillableCrates(
  input: PattaniHandlingQtyInput
): PattaniBillableCrates {
  const asSadao: SadaoHandlingQtyInput = {
    smallCrateTotalQty: 0,
    largeCrateTotalQty: input.crateQty,
    boxTotalQty: input.boxQty,
    smallCrateNoCheckQty: 0,
    largeCrateNoCheckQty: input.crateNoCheckQty,
    boxNoCheckQty: input.boxNoCheckQty,
  };
  const billable = computeSadaoBillableCrates(asSadao);
  return {
    crateBillableQty: billable.largeBillableQty,
    boxBillableQty: billable.boxBillableQty,
  };
}

/** Contractor + SAKRI costs from billable qty (computePattaniDayCosts unchanged). */
export function computePattaniHandlingCosts(
  input: PattaniHandlingQtyInput,
  rates: PattaniDayCostRates
) {
  const billable = computePattaniBillableCrates(input);
  const day = computePattaniDayCosts(
    billable.crateBillableQty,
    billable.boxBillableQty,
    rates
  );
  return { ...billable, ...day };
}
