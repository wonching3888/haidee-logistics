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

/** Effective totals (already resolved: live dispatch or locked manual). */
export interface PattaniHandlingQtyInput {
  crateQty: number;
  boxQty: number;
}

export interface PattaniBillableCrates {
  crateBillableQty: number;
  boxBillableQty: number;
}

export function computePattaniBillableCrates(
  input: PattaniHandlingQtyInput
): PattaniBillableCrates {
  return {
    crateBillableQty: input.crateQty,
    boxBillableQty: input.boxQty,
  };
}

/** Contractor + SAKRI both use the same effective crate/box totals. */
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
