import { describe, expect, it } from "vitest";
import {
  getSadaoHandlingRates,
  SADAO_HANDLING_LARGE_CRATE_HOLIDAY_RATE_THB,
  SADAO_HANDLING_LARGE_CRATE_WEEKDAY_RATE_THB,
  SADAO_HANDLING_SMALL_CRATE_HOLIDAY_RATE_THB,
  SADAO_HANDLING_SMALL_CRATE_WEEKDAY_RATE_THB,
} from "@/lib/constants/thai-cost";
import {
  computeDailyLaborCost,
  computeDailyLaborLunchTotal,
  computeMonthlyWorkerTotal,
  computeSadaoBillableCrates,
  computeSadaoHandlingCommission,
  SadaoHandlingValidationError,
  sumSadaoMonthlyCost,
} from "@/lib/thai-cost/sadao-cost";

const sampleQty = {
  smallCrateTotalQty: 100,
  largeCrateTotalQty: 50,
  boxTotalQty: 20,
  smallCrateNoCheckQty: 10,
  largeCrateNoCheckQty: 5,
  boxNoCheckQty: 2,
};

describe("computeSadaoBillableCrates", () => {
  it("subtracts no-check qty per category independently", () => {
    expect(computeSadaoBillableCrates(sampleQty)).toEqual({
      smallBillableQty: 90,
      largeBillableQty: 45,
      boxBillableQty: 18,
    });
  });

  it("rejects box no-check exceeding total", () => {
    expect(() =>
      computeSadaoBillableCrates({
        smallCrateTotalQty: 10,
        largeCrateTotalQty: 5,
        boxTotalQty: 8,
        smallCrateNoCheckQty: 0,
        largeCrateNoCheckQty: 0,
        boxNoCheckQty: 9,
      })
    ).toThrow(SadaoHandlingValidationError);
  });
});

describe("getSadaoHandlingRates", () => {
  it("uses weekday rates and keeps box === small", () => {
    const rates = getSadaoHandlingRates(false);
    expect(rates.small).toBe(SADAO_HANDLING_SMALL_CRATE_WEEKDAY_RATE_THB);
    expect(rates.large).toBe(SADAO_HANDLING_LARGE_CRATE_WEEKDAY_RATE_THB);
    expect(rates.box).toBe(rates.small);
  });

  it("uses holiday rates and keeps box === small", () => {
    const rates = getSadaoHandlingRates(true);
    expect(rates.small).toBe(SADAO_HANDLING_SMALL_CRATE_HOLIDAY_RATE_THB);
    expect(rates.large).toBe(SADAO_HANDLING_LARGE_CRATE_HOLIDAY_RATE_THB);
    expect(rates.box).toBe(rates.small);
  });
});

describe("computeSadaoHandlingCommission holiday rates", () => {
  it("applies weekday rates 3/4/3", () => {
    const result = computeSadaoHandlingCommission(sampleQty, {
      holidayRate: false,
    });
    expect(result.holidayRate).toBe(false);
    expect(result.smallCommissionThb).toBe(90 * 3);
    expect(result.largeCommissionThb).toBe(45 * 4);
    expect(result.boxCommissionThb).toBe(18 * 3);
    expect(result.rates.box).toBe(result.rates.small);
  });

  it("applies holiday rates 5/6/5", () => {
    const result = computeSadaoHandlingCommission(sampleQty, {
      holidayRate: true,
    });
    expect(result.holidayRate).toBe(true);
    expect(result.smallCommissionThb).toBe(90 * 5);
    expect(result.largeCommissionThb).toBe(45 * 6);
    expect(result.boxCommissionThb).toBe(18 * 5);
    expect(result.rates.box).toBe(result.rates.small);
    expect(result.totalCommissionThb).toBe(450 + 270 + 90);
  });
});

describe("computeDailyLaborCost", () => {
  it("supports holiday wage 400 entered manually", () => {
    expect(computeDailyLaborCost(21, 400)).toBe(8400);
    expect(computeDailyLaborCost(21, 300)).toBe(6300);
  });
});

describe("computeDailyLaborLunchTotal", () => {
  it("uses roster count × 1000 fixed", () => {
    expect(computeDailyLaborLunchTotal(21)).toBe(21000);
  });
});

describe("computeMonthlyWorkerTotal", () => {
  it("sums wage + lunch + fuel + rent", () => {
    expect(
      computeMonthlyWorkerTotal({
        monthlyWage: 9000,
        lunchAllowance: 1000,
        fuelAllowance: 3000,
        rentRoomAllowance: 2500,
      })
    ).toBe(15500);
  });
});

describe("sumSadaoMonthlyCost", () => {
  it("includes all cost families", () => {
    const summary = sumSadaoMonthlyCost({
      monthlyWageTotalThb: 21000,
      monthlyLunchTotalThb: 3000,
      monthlyFuelTotalThb: 3000,
      monthlyRentRoomTotalThb: 2500,
      dailyLaborWageTotalThb: 8400,
      dailyLaborLunchTotalThb: 21000,
      handlingSmallCommissionThb: 500,
      handlingLargeCommissionThb: 300,
      handlingBoxCommissionThb: 100,
    });
    expect(summary.totalCostThb).toBe(
      21000 + 3000 + 3000 + 2500 + 8400 + 21000 + 500 + 300 + 100
    );
  });
});
