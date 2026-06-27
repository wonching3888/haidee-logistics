import { describe, expect, it } from "vitest";
import {
  assertCharterOtherNotDoubleCounted,
  assertCharterUnloadNotDoubleCounted,
  computeCharterEffectiveBorderFeesMyr,
  isCharterCostEligible,
  resolveCharterEffectiveBorderPass,
  resolveCharterEffectiveOther,
  resolveCharterEffectiveUnload,
  resolveCharterLoadingLabor,
  resolveCharterScalarCost,
  type CharterVoucherCostContext,
} from "@/lib/charter-voucher-cost-resolver";
import {
  computeCharterBorderFeesExceptPassMyr,
  computeCharterBorderFeesMyr,
  computeCharterBorderPassMyr,
} from "@/lib/charter-costs";
import {
  computeCharterPnlRow,
  type CharterTripPnlInput,
} from "@/lib/charter-pnl";
import type { GlobalTripCostValues } from "@/lib/operations-cost";

const GLOBAL_COSTS: GlobalTripCostValues = {
  fuelPriceMyr: 2.5,
  borderPass: 25,
  epermit: 10,
  dagangNet: 5,
  forwardingOutbound: 15,
};

function charterVoucher(
  overrides: Partial<CharterVoucherCostContext> = {}
): CharterVoucherCostContext {
  return {
    tripId: "trip-1",
    tripSource: "charter",
    status: "confirmed",
    costAppliedAt: new Date("2026-06-15"),
    ...overrides,
  };
}

function minimalCharterTrip(
  overrides: Partial<CharterTripPnlInput> = {}
): CharterTripPnlInput {
  return {
    id: "trip-1",
    charterNo: "CH-TEST",
    date: new Date("2026-06-15"),
    driverName: "Ali",
    shipperId: null,
    billToCustomerName: "FISHCO",
    includeBorderFees: false,
    charterMileageKm: 100,
    charterRevenueMyr: 1000,
    charterUnloadFeeMyr: 350,
    charterUnloadFeeOverride: null,
    charterBorderPassOverride: null,
    charterLoadingLaborMyr: null,
    charterDriverSalaryMyr: 200,
    charterOtherCostMyr: 0,
    charterOtherCostOverride: null,
    charterTollMyr: 0,
    totalQuantity: 10,
    computedLkimMyr: 50,
    computedCrateRentalMyr: 30,
    truck: {
      plate: "ABC1234",
      fuelEfficiencyKmPerL: 2,
      annualMileageKm: 50000,
      costItems: [{ annualAmount: 12000 }],
    },
    extraItems: [],
    ...overrides,
  };
}

describe("isCharterCostEligible", () => {
  it("requires charter tripSource, costAppliedAt, and confirmed/approved status", () => {
    expect(isCharterCostEligible(charterVoucher())).toBe(true);
    expect(isCharterCostEligible(charterVoucher({ status: "approved" }))).toBe(
      true
    );
    expect(isCharterCostEligible(charterVoucher({ status: "draft" }))).toBe(
      false
    );
    expect(
      isCharterCostEligible(charterVoucher({ status: "clerk_entered" }))
    ).toBe(false);
    expect(
      isCharterCostEligible(charterVoucher({ status: "pending_review" }))
    ).toBe(false);
    expect(isCharterCostEligible(charterVoucher({ status: "rejected" }))).toBe(
      false
    );
    expect(
      isCharterCostEligible(charterVoucher({ costAppliedAt: null }))
    ).toBe(false);
    expect(
      isCharterCostEligible(charterVoucher({ tripSource: "dispatch" }))
    ).toBe(false);
    expect(isCharterCostEligible(null)).toBe(false);
  });
});

describe("resolveCharterScalarCost", () => {
  it("uses override when eligible, otherwise estimate (never both)", () => {
    expect(resolveCharterScalarCost(280, 350, true)).toBe(280);
    expect(resolveCharterScalarCost(280, 350, false)).toBe(350);
    expect(resolveCharterScalarCost(null, 350, true)).toBe(350);
  });
});

describe("resolveCharterEffectiveOther", () => {
  it("50 estimate with no eligible voucher stays 50", () => {
    expect(
      resolveCharterEffectiveOther({
        charterOtherCostMyr: 50,
        charterOtherCostOverride: null,
      })
    ).toBe(50);
  });

  it("confirmed override 20 replaces estimate (not 70)", () => {
    const effective = resolveCharterEffectiveOther({
      charterOtherCostMyr: 50,
      charterOtherCostOverride: 20,
      voucher: charterVoucher(),
    });
    expect(effective).toBe(20);
    expect(effective).not.toBe(70);
    expect(effective).not.toBe(50);
  });

  it("draft voucher keeps estimate even when override column is set", () => {
    expect(
      resolveCharterEffectiveOther({
        charterOtherCostMyr: 50,
        charterOtherCostOverride: 20,
        voucher: charterVoucher({ status: "draft", costAppliedAt: null }),
      })
    ).toBe(50);
  });
});

describe("assertCharterOtherNotDoubleCounted", () => {
  it("passes for eligible override and rejects estimate+actual sum", () => {
    assertCharterOtherNotDoubleCounted({
      effectiveOther: 20,
      estimate: 50,
      override: 20,
      actual: 20,
      eligible: true,
    });
    expect(() =>
      assertCharterOtherNotDoubleCounted({
        effectiveOther: 70,
        estimate: 50,
        override: 20,
        actual: 20,
        eligible: true,
      })
    ).toThrow(/effectiveOther 70/);
  });
});

describe("resolveCharterEffectiveUnload", () => {
  it("350 estimate with no eligible voucher stays 350", () => {
    expect(
      resolveCharterEffectiveUnload({
        charterUnloadFeeMyr: 350,
        charterUnloadFeeOverride: null,
      })
    ).toBe(350);
  });

  it("confirmed override 280 replaces estimate (not 630)", () => {
    const effective = resolveCharterEffectiveUnload({
      charterUnloadFeeMyr: 350,
      charterUnloadFeeOverride: 280,
      voucher: charterVoucher(),
    });
    expect(effective).toBe(280);
    expect(effective).not.toBe(630);
    expect(effective).not.toBe(350);
  });

  it("draft voucher keeps estimate even when override column is set", () => {
    expect(
      resolveCharterEffectiveUnload({
        charterUnloadFeeMyr: 350,
        charterUnloadFeeOverride: 280,
        voucher: charterVoucher({ status: "draft", costAppliedAt: null }),
      })
    ).toBe(350);
  });
});

describe("assertCharterUnloadNotDoubleCounted", () => {
  it("passes for eligible override and rejects estimate+actual sum", () => {
    assertCharterUnloadNotDoubleCounted({
      effectiveUnload: 280,
      estimate: 350,
      override: 280,
      actual: 280,
      eligible: true,
    });
    expect(() =>
      assertCharterUnloadNotDoubleCounted({
        effectiveUnload: 630,
        estimate: 350,
        override: 280,
        actual: 280,
        eligible: true,
      })
    ).toThrow(/effectiveUnload 630/);
  });
});

describe("computeCharterPnlRow unload override", () => {
  it("no voucher: unload=350 from estimate", () => {
    const row = computeCharterPnlRow(minimalCharterTrip(), GLOBAL_COSTS);
    expect(row).not.toBeNull();
    expect(row!.shippers[0]!.unloadFeeMyr).toBe(350);
  });

  it("confirmed actual 280: P&L unload=280, totalCost delta -70 vs estimate", () => {
    const estimateRow = computeCharterPnlRow(minimalCharterTrip(), GLOBAL_COSTS)!;
    const actualRow = computeCharterPnlRow(
      minimalCharterTrip({ charterUnloadFeeOverride: 280 }),
      GLOBAL_COSTS,
      charterVoucher()
    )!;

    expect(actualRow.shippers[0]!.unloadFeeMyr).toBe(280);
    expect(actualRow.totalCostMyr).toBe(estimateRow.totalCostMyr - 70);
    expect(actualRow.totalCostMyr).not.toBe(estimateRow.totalCostMyr + 280);
  });

  it("rejected voucher falls back to estimate even if override column stale", () => {
    const row = computeCharterPnlRow(
      minimalCharterTrip({ charterUnloadFeeOverride: 280 }),
      GLOBAL_COSTS,
      charterVoucher({ status: "rejected", costAppliedAt: null })
    )!;
    expect(row.shippers[0]!.unloadFeeMyr).toBe(350);
  });

  it("does not mutate charterUnloadFeeMyr estimate field in input", () => {
    const trip = minimalCharterTrip();
    computeCharterPnlRow(
      trip,
      GLOBAL_COSTS,
      charterVoucher({ status: "confirmed" })
    );
    expect(trip.charterUnloadFeeMyr).toBe(350);
  });
});

describe("computeCharterPnlRow other override", () => {
  it("no voucher: other=50 from estimate", () => {
    const row = computeCharterPnlRow(
      minimalCharterTrip({ charterOtherCostMyr: 50 }),
      GLOBAL_COSTS
    )!;
    expect(row.directCostMyr).toBeGreaterThan(0);
    const base = computeCharterPnlRow(
      minimalCharterTrip({ charterOtherCostMyr: 0 }),
      GLOBAL_COSTS
    )!;
    expect(row.directCostMyr - base.directCostMyr).toBe(50);
  });

  it("confirmed actual 20: totalCost delta -30 vs estimate", () => {
    const estimateRow = computeCharterPnlRow(
      minimalCharterTrip({ charterOtherCostMyr: 50 }),
      GLOBAL_COSTS
    )!;
    const actualRow = computeCharterPnlRow(
      minimalCharterTrip({
        charterOtherCostMyr: 50,
        charterOtherCostOverride: 20,
      }),
      GLOBAL_COSTS,
      charterVoucher()
    )!;

    expect(actualRow.totalCostMyr).toBe(estimateRow.totalCostMyr - 30);
    expect(actualRow.totalCostMyr).not.toBe(estimateRow.totalCostMyr + 20);
  });

  it("rejected voucher falls back to estimate even if override column stale", () => {
    const estimateRow = computeCharterPnlRow(
      minimalCharterTrip({ charterOtherCostMyr: 50 }),
      GLOBAL_COSTS
    )!;
    const row = computeCharterPnlRow(
      minimalCharterTrip({
        charterOtherCostMyr: 50,
        charterOtherCostOverride: 20,
      }),
      GLOBAL_COSTS,
      charterVoucher({ status: "rejected", costAppliedAt: null })
    )!;
    expect(row.totalCostMyr).toBe(estimateRow.totalCostMyr);
  });

  it("does not mutate charterOtherCostMyr estimate field in input", () => {
    const trip = minimalCharterTrip({ charterOtherCostMyr: 50 });
    computeCharterPnlRow(trip, GLOBAL_COSTS, charterVoucher());
    expect(trip.charterOtherCostMyr).toBe(50);
  });

  it("extra cost items stay independent from Other override", () => {
    const extraItems = [{ itemType: "cost", amountMyr: 25 }];
    const estimateRow = computeCharterPnlRow(
      minimalCharterTrip({
        charterOtherCostMyr: 50,
        extraItems,
      }),
      GLOBAL_COSTS
    )!;
    const actualRow = computeCharterPnlRow(
      minimalCharterTrip({
        charterOtherCostMyr: 50,
        charterOtherCostOverride: 20,
        extraItems,
      }),
      GLOBAL_COSTS,
      charterVoucher()
    )!;
    const otherOnlyEstimate = computeCharterPnlRow(
      minimalCharterTrip({ charterOtherCostMyr: 50 }),
      GLOBAL_COSTS
    )!;
    const otherOnlyActual = computeCharterPnlRow(
      minimalCharterTrip({
        charterOtherCostMyr: 50,
        charterOtherCostOverride: 20,
      }),
      GLOBAL_COSTS,
      charterVoucher()
    )!;

    expect(actualRow.totalCostMyr - estimateRow.totalCostMyr).toBe(-30);
    expect(
      otherOnlyActual.totalCostMyr - otherOnlyEstimate.totalCostMyr
    ).toBe(-30);
    expect(estimateRow.totalCostMyr - otherOnlyEstimate.totalCostMyr).toBe(25);
    expect(actualRow.totalCostMyr - otherOnlyActual.totalCostMyr).toBe(25);
  });
});

describe("computeCharterPnlRow unload + other same voucher", () => {
  it("each override applies independently without cross double-count", () => {
    const estimateRow = computeCharterPnlRow(
      minimalCharterTrip({
        charterOtherCostMyr: 50,
      }),
      GLOBAL_COSTS
    )!;
    const actualRow = computeCharterPnlRow(
      minimalCharterTrip({
        charterUnloadFeeOverride: 280,
        charterOtherCostOverride: 20,
        charterOtherCostMyr: 50,
      }),
      GLOBAL_COSTS,
      charterVoucher()
    )!;

    expect(actualRow.shippers[0]!.unloadFeeMyr).toBe(280);
    expect(actualRow.totalCostMyr).toBe(estimateRow.totalCostMyr - 100);
    expect(actualRow.totalCostMyr).not.toBe(
      estimateRow.totalCostMyr + 280 + 20
    );
  });
});

const BORDER_GLOBAL: GlobalTripCostValues = {
  fuelPriceMyr: 2.5,
  borderPass: 25,
  epermit: 10,
  dagangNet: 5,
  forwardingOutbound: 5,
};

describe("computeCharterBorderFees split", () => {
  it("pass + exceptPass equals full border fees", () => {
    expect(computeCharterBorderPassMyr(true, BORDER_GLOBAL)).toBe(25);
    expect(computeCharterBorderFeesExceptPassMyr(true, BORDER_GLOBAL)).toBe(20);
    expect(computeCharterBorderFeesMyr(true, BORDER_GLOBAL)).toBe(45);
  });

  it("includeBorderFees=false yields zero for all parts", () => {
    expect(computeCharterBorderPassMyr(false, BORDER_GLOBAL)).toBe(0);
    expect(computeCharterBorderFeesExceptPassMyr(false, BORDER_GLOBAL)).toBe(0);
    expect(computeCharterBorderFeesMyr(false, BORDER_GLOBAL)).toBe(0);
  });
});

describe("resolveCharterEffectiveBorderPass", () => {
  it("no eligible voucher uses global pass estimate", () => {
    expect(
      resolveCharterEffectiveBorderPass({
        includeBorderFees: true,
        charterBorderPassOverride: null,
        globalCosts: BORDER_GLOBAL,
      })
    ).toBe(25);
  });

  it("confirmed override 30 replaces pass only (not added to 25)", () => {
    const effective = resolveCharterEffectiveBorderPass({
      includeBorderFees: true,
      charterBorderPassOverride: 30,
      globalCosts: BORDER_GLOBAL,
      voucher: charterVoucher(),
    });
    expect(effective).toBe(30);
    expect(effective).not.toBe(55);
  });

  it("includeBorderFees=false returns 0 even with override and eligible voucher (read-time zero)", () => {
    expect(
      resolveCharterEffectiveBorderPass({
        includeBorderFees: false,
        charterBorderPassOverride: 30,
        globalCosts: BORDER_GLOBAL,
        voucher: charterVoucher(),
      })
    ).toBe(0);
  });

  it("rejected voucher falls back to estimate pass", () => {
    expect(
      resolveCharterEffectiveBorderPass({
        includeBorderFees: true,
        charterBorderPassOverride: 30,
        globalCosts: BORDER_GLOBAL,
        voucher: charterVoucher({ status: "rejected", costAppliedAt: null }),
      })
    ).toBe(25);
  });
});

describe("computeCharterEffectiveBorderFeesMyr", () => {
  it("pass25 epermit10 dagang5 fwd5 → total 45 without voucher", () => {
    expect(
      computeCharterEffectiveBorderFeesMyr({
        includeBorderFees: true,
        charterBorderPassOverride: null,
        globalCosts: BORDER_GLOBAL,
      })
    ).toBe(45);
  });

  it("chop30 confirmed → total 50 (30+10+5+5), not 75 or 30 alone", () => {
    const total = computeCharterEffectiveBorderFeesMyr({
      includeBorderFees: true,
      charterBorderPassOverride: 30,
      globalCosts: BORDER_GLOBAL,
      voucher: charterVoucher(),
    });
    expect(total).toBe(50);
    expect(total).not.toBe(75);
    expect(total).not.toBe(30);
  });

  it("epermit/dagang/forwarding unchanged when chop changes pass", () => {
    const base = computeCharterEffectiveBorderFeesMyr({
      includeBorderFees: true,
      charterBorderPassOverride: null,
      globalCosts: BORDER_GLOBAL,
    });
    const actual = computeCharterEffectiveBorderFeesMyr({
      includeBorderFees: true,
      charterBorderPassOverride: 30,
      globalCosts: BORDER_GLOBAL,
      voucher: charterVoucher(),
    });
    expect(actual - base).toBe(5);
    expect(computeCharterBorderFeesExceptPassMyr(true, BORDER_GLOBAL)).toBe(20);
  });

  it("includeBorderFees=false → border total 0", () => {
    expect(
      computeCharterEffectiveBorderFeesMyr({
        includeBorderFees: false,
        charterBorderPassOverride: 30,
        globalCosts: BORDER_GLOBAL,
        voucher: charterVoucher(),
      })
    ).toBe(0);
  });
});

describe("computeCharterPnlRow border pass override", () => {
  function borderTrip(
    overrides: Partial<CharterTripPnlInput> = {}
  ): CharterTripPnlInput {
    return minimalCharterTrip({
      includeBorderFees: true,
      ...overrides,
    });
  }

  it("no voucher: border fees total 45, pass=25", () => {
    const row = computeCharterPnlRow(borderTrip(), BORDER_GLOBAL)!;
    expect(row.vehicleCosts.borderPassMyr).toBe(25);
    expect(row.vehicleCosts.epermitMyr).toBe(10);
    expect(row.vehicleCosts.dagangNetMyr).toBe(5);
    expect(row.vehicleCosts.forwardingMyr).toBe(5);
    const borderInAllocated =
      row.vehicleCosts.borderPassMyr +
      row.vehicleCosts.epermitMyr +
      row.vehicleCosts.dagangNetMyr +
      row.vehicleCosts.forwardingMyr;
    expect(borderInAllocated).toBe(45);
  });

  it("confirmed chop30: totalCost delta +5 vs estimate", () => {
    const estimateRow = computeCharterPnlRow(borderTrip(), BORDER_GLOBAL)!;
    const actualRow = computeCharterPnlRow(
      borderTrip({ charterBorderPassOverride: 30 }),
      BORDER_GLOBAL,
      charterVoucher()
    )!;
    expect(actualRow.vehicleCosts.borderPassMyr).toBe(30);
    expect(actualRow.vehicleCosts.epermitMyr).toBe(10);
    expect(actualRow.totalCostMyr).toBe(estimateRow.totalCostMyr + 5);
  });

  it("includeBorderFees=false: pass=0 and border total=0 despite override column", () => {
    const row = computeCharterPnlRow(
      borderTrip({
        includeBorderFees: false,
        charterBorderPassOverride: 30,
      }),
      BORDER_GLOBAL,
      charterVoucher()
    )!;
    expect(row.vehicleCosts.borderPassMyr).toBe(0);
    expect(row.vehicleCosts.epermitMyr).toBe(0);
    expect(row.vehicleCosts.dagangNetMyr).toBe(0);
    expect(row.vehicleCosts.forwardingMyr).toBe(0);
  });
});

describe("computeCharterPnlRow unload + other + border same voucher", () => {
  it("totalCost delta equals sum of independent pass/unload/other deltas", () => {
    const estimateRow = computeCharterPnlRow(
      minimalCharterTrip({
        includeBorderFees: true,
        charterOtherCostMyr: 50,
      }),
      BORDER_GLOBAL
    )!;
    const actualRow = computeCharterPnlRow(
      minimalCharterTrip({
        includeBorderFees: true,
        charterUnloadFeeOverride: 280,
        charterOtherCostOverride: 20,
        charterBorderPassOverride: 30,
        charterOtherCostMyr: 50,
      }),
      BORDER_GLOBAL,
      charterVoucher()
    )!;

    const unloadDelta = 280 - 350;
    const otherDelta = 20 - 50;
    const borderDelta = 30 - 25;
    expect(actualRow.totalCostMyr - estimateRow.totalCostMyr).toBe(
      unloadDelta + otherDelta + borderDelta
    );
    expect(actualRow.totalCostMyr - estimateRow.totalCostMyr).toBe(-95);
  });
});

describe("resolveCharterLoadingLabor", () => {
  it("returns 0 without eligible voucher", () => {
    expect(
      resolveCharterLoadingLabor({
        charterLoadingLaborMyr: 120,
      })
    ).toBe(0);
    expect(
      resolveCharterLoadingLabor({
        charterLoadingLaborMyr: 120,
        voucher: charterVoucher({ status: "draft", costAppliedAt: null }),
      })
    ).toBe(0);
  });

  it("returns stored actual when eligible", () => {
    expect(
      resolveCharterLoadingLabor({
        charterLoadingLaborMyr: 120,
        voucher: charterVoucher(),
      })
    ).toBe(120);
  });

  it("returns 0 when eligible but stored null", () => {
    expect(
      resolveCharterLoadingLabor({
        charterLoadingLaborMyr: null,
        voucher: charterVoucher(),
      })
    ).toBe(0);
  });
});

describe("computeCharterPnlRow loading labor (batch 5)", () => {
  it("no voucher: loadingLabor=0, totalCost unchanged vs pre-batch-5", () => {
    const row = computeCharterPnlRow(
      minimalCharterTrip({ charterLoadingLaborMyr: 120 }),
      GLOBAL_COSTS
    )!;
    expect(row.shippers[0]!.loadingLaborMyr).toBe(0);
    const baseline = computeCharterPnlRow(minimalCharterTrip(), GLOBAL_COSTS)!;
    expect(row.totalCostMyr).toBe(baseline.totalCostMyr);
  });

  it("confirmed actual 120: totalCost +120 only", () => {
    const baseline = computeCharterPnlRow(minimalCharterTrip(), GLOBAL_COSTS)!;
    const actual = computeCharterPnlRow(
      minimalCharterTrip({ charterLoadingLaborMyr: 120 }),
      GLOBAL_COSTS,
      charterVoucher()
    )!;
    expect(actual.shippers[0]!.loadingLaborMyr).toBe(120);
    expect(actual.totalCostMyr).toBe(baseline.totalCostMyr + 120);
  });

  it("does not alter driver salary or crate rental when loading labor applies", () => {
    const trip = minimalCharterTrip({
      charterDriverSalaryMyr: 200,
      computedCrateRentalMyr: 80,
      charterLoadingLaborMyr: 120,
    });
    const baseline = computeCharterPnlRow(trip, GLOBAL_COSTS)!;
    const actual = computeCharterPnlRow(trip, GLOBAL_COSTS, charterVoucher())!;

    expect(actual.totalCostMyr - baseline.totalCostMyr).toBe(120);
    expect(actual.shippers[0]!.crateRentalMyr).toBe(80);
    expect(baseline.shippers[0]!.crateRentalMyr).toBe(80);
    const salaryInCore =
      actual.shippers[0]!.directCostMyr -
      actual.shippers[0]!.crateRentalMyr -
      actual.shippers[0]!.lkimMaqisMyr;
    expect(salaryInCore).toBe(200);
  });

  it("rejected voucher: loading labor back to 0", () => {
    const baseline = computeCharterPnlRow(minimalCharterTrip(), GLOBAL_COSTS)!;
    const row = computeCharterPnlRow(
      minimalCharterTrip({ charterLoadingLaborMyr: 120 }),
      GLOBAL_COSTS,
      charterVoucher({ status: "rejected", costAppliedAt: null })
    )!;
    expect(row.shippers[0]!.loadingLaborMyr).toBe(0);
    expect(row.totalCostMyr).toBe(baseline.totalCostMyr);
  });
});

describe("computeCharterPnlRow batches 2/3/4/5 same voucher", () => {
  it("totalCost delta equals sum of unload/other/border/loading deltas", () => {
    const estimateRow = computeCharterPnlRow(
      minimalCharterTrip({
        includeBorderFees: true,
        charterOtherCostMyr: 50,
      }),
      BORDER_GLOBAL
    )!;
    const actualRow = computeCharterPnlRow(
      minimalCharterTrip({
        includeBorderFees: true,
        charterUnloadFeeOverride: 280,
        charterOtherCostOverride: 20,
        charterBorderPassOverride: 30,
        charterLoadingLaborMyr: 120,
        charterOtherCostMyr: 50,
      }),
      BORDER_GLOBAL,
      charterVoucher()
    )!;

    const unloadDelta = 280 - 350;
    const otherDelta = 20 - 50;
    const borderDelta = 30 - 25;
    const loadingDelta = 120;
    expect(actualRow.totalCostMyr - estimateRow.totalCostMyr).toBe(
      unloadDelta + otherDelta + borderDelta + loadingDelta
    );
    expect(actualRow.totalCostMyr - estimateRow.totalCostMyr).toBe(25);
    expect(actualRow.shippers[0]!.loadingLaborMyr).toBe(120);
  });
});
