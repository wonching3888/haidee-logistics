import { describe, expect, it } from "vitest";
import {
  assertCharterOtherNotDoubleCounted,
  assertCharterUnloadNotDoubleCounted,
  isCharterCostEligible,
  resolveCharterEffectiveOther,
  resolveCharterEffectiveUnload,
  resolveCharterScalarCost,
  type CharterVoucherCostContext,
} from "@/lib/charter-voucher-cost-resolver";
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
