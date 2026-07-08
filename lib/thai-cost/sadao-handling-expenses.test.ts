import { describe, expect, it } from "vitest";
import {
  computeSadaoHandlingDayTotalThb,
  normalizeSadaoHandlingOtherExpenses,
  SadaoHandlingExpenseValidationError,
  sumSadaoHandlingOtherExpensesThb,
} from "@/lib/thai-cost/sadao-handling-expenses";
import { sumSadaoMonthlyCost } from "@/lib/thai-cost/sadao-cost";

describe("sadao-handling-expenses", () => {
  it("sums other expense lines", () => {
    expect(
      sumSadaoHandlingOtherExpensesThb([
        { amountThb: 200 },
        { amountThb: 50 },
      ])
    ).toBe(250);
  });

  it("computes day total as commission + other expenses", () => {
    expect(computeSadaoHandlingDayTotalThb(4353, 250)).toBe(4603);
  });

  it("drops blank rows and keeps valid lines", () => {
    expect(
      normalizeSadaoHandlingOtherExpenses([
        { description: "维修费", amountThb: 200 },
        { description: "", amountThb: 0 },
        { description: "过路费", amountThb: 50 },
      ])
    ).toEqual([
      { description: "维修费", amountThb: 200 },
      { description: "过路费", amountThb: 50 },
    ]);
  });

  it("requires description when amount is set", () => {
    expect(() =>
      normalizeSadaoHandlingOtherExpenses([
        { description: "", amountThb: 100 },
      ])
    ).toThrow(SadaoHandlingExpenseValidationError);
  });

  it("rolls other expenses into monthly handling total", () => {
    const summary = sumSadaoMonthlyCost({
      monthlyWageTotalThb: 0,
      monthlyLunchTotalThb: 0,
      monthlyFuelTotalThb: 0,
      monthlyRentRoomTotalThb: 0,
      dailyLaborWageTotalThb: 0,
      dailyLaborLunchTotalThb: 0,
      handlingSmallCommissionThb: 100,
      handlingLargeCommissionThb: 50,
      handlingBoxCommissionThb: 25,
      handlingOtherExpensesThb: 250,
    });
    expect(summary.handlingCommissionTotalThb).toBe(425);
    expect(summary.totalCostThb).toBe(425);
  });
});
