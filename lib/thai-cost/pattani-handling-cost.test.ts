import { describe, expect, it } from "vitest";
import { SadaoHandlingValidationError } from "@/lib/thai-cost/sadao-cost";
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
  it("billable = total − direct per category", () => {
    const b = computePattaniBillableCrates({
      crateQty: 82,
      boxQty: 10,
      crateNoCheckQty: 12,
      boxNoCheckQty: 3,
    });
    expect(b.crateBillableQty).toBe(70);
    expect(b.boxBillableQty).toBe(7);
  });

  it("rejects direct > total", () => {
    expect(() =>
      computePattaniBillableCrates({
        crateQty: 10,
        boxQty: 5,
        crateNoCheckQty: 11,
        boxNoCheckQty: 0,
      })
    ).toThrow(SadaoHandlingValidationError);
  });
});

describe("computePattaniHandlingCosts", () => {
  it("contractor and SAKRI both use billable qty", () => {
    const costs = computePattaniHandlingCosts(
      {
        crateQty: 100,
        boxQty: 20,
        crateNoCheckQty: 30,
        boxNoCheckQty: 5,
      },
      rates
    );
    expect(costs.crateBillableQty).toBe(70);
    expect(costs.boxBillableQty).toBe(15);
    expect(costs.contractorThb).toBe(70 * 20 + 15 * 5);
    expect(costs.sakriCommissionThb).toBe(70 * 2.2);
  });
});
