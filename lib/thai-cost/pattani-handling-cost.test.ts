import { describe, expect, it } from "vitest";
import {
  computePattaniBillableCrates,
  computePattaniHandlingCosts,
} from "@/lib/thai-cost/pattani-handling-cost";

const rates = {
  pattaniContractorCrate: 20,
  pattaniContractorBox: 5,
  pattaniSakriCrate: 2.2,
};

describe("computePattaniBillableCrates", () => {
  it("uses effective totals as billable", () => {
    expect(
      computePattaniBillableCrates({ crateQty: 82, boxQty: 10 })
    ).toEqual({ crateBillableQty: 82, boxBillableQty: 10 });
  });
});

describe("computePattaniHandlingCosts", () => {
  it("contractor and SAKRI share the same effective crate qty", () => {
    const costs = computePattaniHandlingCosts(
      { crateQty: 315, boxQty: 50 },
      rates
    );
    expect(costs.crateBillableQty).toBe(315);
    expect(costs.boxBillableQty).toBe(50);
    expect(costs.contractorThb).toBe(315 * 20 + 50 * 5);
    expect(costs.sakriCommissionThb).toBe(315 * 2.2);
  });
});
