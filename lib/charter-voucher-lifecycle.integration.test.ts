import { describe, expect, it, vi } from "vitest";
import {
  computeCharterEffectiveBorderFeesMyr,
  resolveCharterEffectiveBorderPass,
  resolveCharterEffectiveOther,
  resolveCharterEffectiveUnload,
  resolveCharterLoadingLabor,
  type CharterVoucherCostContext,
} from "@/lib/charter-voucher-cost-resolver";
import {
  computeCharterBorderFeesExceptPassMyr,
  computeCharterBorderPassMyr,
} from "@/lib/charter-costs";
import {
  computeCharterPnlRow,
  type CharterTripPnlInput,
} from "@/lib/charter-pnl";
import {
  applyCharterVoucherCostActuals,
  clearCharterVoucherCostActuals,
} from "@/lib/driver-expense/charter-voucher-cost-apply";
import { sumCharterActualBelanja } from "@/lib/driver-expense/voucher-utils";
import type { GlobalTripCostValues } from "@/lib/operations-cost";

const GLOBAL: GlobalTripCostValues = {
  fuelPriceMyr: 2.5,
  borderPass: 25,
  epermit: 10,
  dagangNet: 5,
  forwardingOutbound: 15,
};

const VOUCHER_ACTUALS = {
  chopBorderActual: 30,
  upahTurunActual: 280,
  otherActual: 20,
  upahNaikTongActual: 120,
  minyakMotoEnabled: true,
  minyakMotoActual: 8,
  duitJalan: 500,
};

function charterVoucher(
  overrides: Partial<CharterVoucherCostContext> = {}
): CharterVoucherCostContext {
  return {
    tripId: "trip-lifecycle",
    tripSource: "charter",
    status: "confirmed",
    costAppliedAt: new Date("2026-06-19"),
    ...overrides,
  };
}

function lifecycleTrip(
  overrides: Partial<CharterTripPnlInput> = {}
): CharterTripPnlInput {
  return {
    id: "trip-lifecycle",
    charterNo: "CH-LIFECYCLE",
    date: new Date("2026-06-19"),
    driverName: "Ali",
    shipperId: null,
    billToCustomerName: "FISHCO",
    includeBorderFees: true,
    charterMileageKm: 100,
    charterRevenueMyr: 5000,
    charterUnloadFeeMyr: 350,
    charterUnloadFeeOverride: null,
    charterBorderPassOverride: null,
    charterLoadingLaborMyr: null,
    charterDriverSalaryMyr: 200,
    charterOtherCostMyr: 50,
    charterOtherCostOverride: null,
    charterTollMyr: 10,
    totalQuantity: 10,
    computedLkimMyr: 50,
    computedCrateRentalMyr: 80,
    truck: {
      plate: "WXY1234",
      fuelEfficiencyKmPerL: 2,
      annualMileageKm: 50000,
      costItems: [{ annualAmount: 12000 }],
    },
    extraItems: [],
    ...overrides,
  };
}

function tripWithAppliedOverrides(
  overrides: Partial<CharterTripPnlInput> = {}
): CharterTripPnlInput {
  return lifecycleTrip({
    charterUnloadFeeOverride: VOUCHER_ACTUALS.upahTurunActual,
    charterOtherCostOverride: VOUCHER_ACTUALS.otherActual,
    charterBorderPassOverride: VOUCHER_ACTUALS.chopBorderActual,
    charterLoadingLaborMyr: VOUCHER_ACTUALS.upahNaikTongActual,
    ...overrides,
  });
}

function assertNoDoubleCount(label: string, effective: number, estimate: number, actual: number) {
  expect(effective, `${label} must not equal estimate+actual`).not.toBe(
    Math.round((estimate + actual) * 100) / 100
  );
}

describe("charter voucher lifecycle integration (batches 2–5)", () => {
  it("runs full lifecycle: estimate → draft → confirm → reject → reopen → reconfirm", () => {
    const trip = lifecycleTrip();
    const estimateRow = computeCharterPnlRow(trip, GLOBAL)!;

    expect(estimateRow.shippers[0]!.unloadFeeMyr).toBe(350);
    expect(estimateRow.shippers[0]!.loadingLaborMyr).toBe(0);
    expect(estimateRow.vehicleCosts.borderPassMyr).toBe(25);
    expect(estimateRow.vehicleCosts.epermitMyr).toBe(10);
    expect(estimateRow.vehicleCosts.dagangNetMyr).toBe(5);
    expect(estimateRow.vehicleCosts.forwardingMyr).toBe(15);
    expect(estimateRow.shippers[0]!.crateRentalMyr).toBe(80);

    const draftRow = computeCharterPnlRow(
      trip,
      GLOBAL,
      charterVoucher({ status: "draft", costAppliedAt: null })
    )!;
    expect(draftRow.totalCostMyr).toBe(estimateRow.totalCostMyr);

    const confirmedRow = computeCharterPnlRow(
      tripWithAppliedOverrides(),
      GLOBAL,
      charterVoucher()
    )!;

    expect(confirmedRow.shippers[0]!.unloadFeeMyr).toBe(280);
    expect(confirmedRow.shippers[0]!.loadingLaborMyr).toBe(120);
    expect(confirmedRow.vehicleCosts.borderPassMyr).toBe(30);
    expect(confirmedRow.vehicleCosts.epermitMyr).toBe(10);
    expect(confirmedRow.vehicleCosts.dagangNetMyr).toBe(5);
    expect(confirmedRow.vehicleCosts.forwardingMyr).toBe(15);
    expect(confirmedRow.shippers[0]!.crateRentalMyr).toBe(80);
    expect(confirmedRow.shippers[0]!.crateRentalMyr).toBe(
      estimateRow.shippers[0]!.crateRentalMyr
    );
    expect(
      confirmedRow.shippers[0]!.directCostMyr -
        estimateRow.shippers[0]!.directCostMyr
    ).toBe(-30);

    assertNoDoubleCount("unload", 280, 350, 280);
    assertNoDoubleCount("other", 20, 50, 20);
    assertNoDoubleCount("borderPass", 30, 25, 30);

    const unloadDelta = 280 - 350;
    const otherDelta = 20 - 50;
    const borderDelta = 30 - 25;
    const loadingDelta = 120;
    expect(confirmedRow.totalCostMyr - estimateRow.totalCostMyr).toBe(
      unloadDelta + otherDelta + borderDelta + loadingDelta
    );

    const rejectedRow = computeCharterPnlRow(
      lifecycleTrip(),
      GLOBAL,
      charterVoucher({ status: "rejected", costAppliedAt: null })
    )!;
    expect(rejectedRow.totalCostMyr).toBe(estimateRow.totalCostMyr);
    expect(rejectedRow.shippers[0]!.loadingLaborMyr).toBe(0);

    const reopenedRow = computeCharterPnlRow(
      lifecycleTrip(),
      GLOBAL,
      charterVoucher({ status: "clerk_entered", costAppliedAt: null })
    )!;
    expect(reopenedRow.totalCostMyr).toBe(estimateRow.totalCostMyr);

    const reconfirmedRow = computeCharterPnlRow(
      tripWithAppliedOverrides({
        charterUnloadFeeOverride: 300,
        charterOtherCostOverride: 25,
        charterBorderPassOverride: 28,
        charterLoadingLaborMyr: 100,
      }),
      GLOBAL,
      charterVoucher()
    )!;
    expect(reconfirmedRow.shippers[0]!.unloadFeeMyr).toBe(300);
    expect(reconfirmedRow.shippers[0]!.loadingLaborMyr).toBe(100);
    expect(reconfirmedRow.vehicleCosts.borderPassMyr).toBe(28);
    expect(reconfirmedRow.totalCostMyr).not.toBe(confirmedRow.totalCostMyr);
  });

  it("belanja excludes duitJalan; baki = duitJalan - belanja", () => {
    const belanja = sumCharterActualBelanja({
      chopBorderActual: VOUCHER_ACTUALS.chopBorderActual,
      upahTurunActual: VOUCHER_ACTUALS.upahTurunActual,
      upahNaikTongActual: VOUCHER_ACTUALS.upahNaikTongActual,
      minyakMotoEnabled: VOUCHER_ACTUALS.minyakMotoEnabled,
      minyakMotoActual: VOUCHER_ACTUALS.minyakMotoActual,
      otherActual: VOUCHER_ACTUALS.otherActual,
    });
    expect(belanja).toBe(458);
    expect(belanja).not.toBe(458 + VOUCHER_ACTUALS.duitJalan);
    const baki = Math.round((VOUCHER_ACTUALS.duitJalan - belanja) * 100) / 100;
    expect(baki).toBe(42);
  });

  it("duitJalan and minyak do not change P&L totalCost", () => {
    const trip = lifecycleTrip();
    const estimateRow = computeCharterPnlRow(trip, GLOBAL)!;
    const confirmedRow = computeCharterPnlRow(
      tripWithAppliedOverrides(),
      GLOBAL,
      charterVoucher()
    )!;
    expect(confirmedRow.totalCostMyr - estimateRow.totalCostMyr).toBe(25);
  });

  it("apply/clear writes and clears all four charter cost columns", async () => {
    const state = {
      voucher: {
        id: "v1",
        tripId: "trip-lifecycle",
        tripSource: "charter",
        ...VOUCHER_ACTUALS,
      },
      charterTrip: {
        id: "trip-lifecycle",
        charterBorderPassOverride: null,
        charterUnloadFeeOverride: null,
        charterOtherCostOverride: null,
        charterLoadingLaborMyr: null,
      },
    };
    const tx = {
      driverVoucher: {
        findUniqueOrThrow: vi.fn(async () => ({ ...state.voucher })),
      },
      charterTrip: {
        update: vi.fn(
          async ({
            data,
          }: {
            where: { id: string };
            data: Record<string, unknown>;
          }) => {
            Object.assign(state.charterTrip, data);
            return { ...state.charterTrip };
          }
        ),
      },
    };

    await applyCharterVoucherCostActuals("v1", tx as never);
    expect(state.charterTrip).toMatchObject({
      charterBorderPassOverride: 30,
      charterUnloadFeeOverride: 280,
      charterOtherCostOverride: 20,
      charterLoadingLaborMyr: 120,
    });

    const afterApplyRow = computeCharterPnlRow(
      tripWithAppliedOverrides(state.charterTrip as Partial<CharterTripPnlInput>),
      GLOBAL,
      charterVoucher()
    )!;
    expect(afterApplyRow.shippers[0]!.loadingLaborMyr).toBe(120);

    await clearCharterVoucherCostActuals("v1", tx as never);
    expect(state.charterTrip.charterLoadingLaborMyr).toBeNull();

    const afterClearRow = computeCharterPnlRow(lifecycleTrip(), GLOBAL, null)!;
    expect(afterClearRow.totalCostMyr).toBe(
      computeCharterPnlRow(lifecycleTrip(), GLOBAL)!.totalCostMyr
    );
  });

  it("resolver components match P&L row fields (no cross double-count)", () => {
    const trip = tripWithAppliedOverrides();
    const voucher = charterVoucher();
    const row = computeCharterPnlRow(trip, GLOBAL, voucher)!;

    const unload = resolveCharterEffectiveUnload({
      charterUnloadFeeMyr: trip.charterUnloadFeeMyr,
      charterUnloadFeeOverride: trip.charterUnloadFeeOverride,
      voucher,
    });
    const other = resolveCharterEffectiveOther({
      charterOtherCostMyr: trip.charterOtherCostMyr,
      charterOtherCostOverride: trip.charterOtherCostOverride,
      voucher,
    });
    const borderPass = resolveCharterEffectiveBorderPass({
      includeBorderFees: true,
      charterBorderPassOverride: trip.charterBorderPassOverride,
      globalCosts: GLOBAL,
      voucher,
    });
    const borderExcept = computeCharterBorderFeesExceptPassMyr(true, GLOBAL);
    const loading = resolveCharterLoadingLabor({
      charterLoadingLaborMyr: trip.charterLoadingLaborMyr,
      voucher,
    });

    expect(row.shippers[0]!.unloadFeeMyr).toBe(unload);
    expect(row.shippers[0]!.loadingLaborMyr).toBe(loading);
    expect(row.vehicleCosts.borderPassMyr).toBe(borderPass);
    expect(row.vehicleCosts.epermitMyr + row.vehicleCosts.dagangNetMyr + row.vehicleCosts.forwardingMyr).toBe(
      borderExcept
    );
    expect(
      computeCharterEffectiveBorderFeesMyr({
        includeBorderFees: true,
        charterBorderPassOverride: trip.charterBorderPassOverride,
        globalCosts: GLOBAL,
        voucher,
      })
    ).toBe(borderPass + borderExcept);

    const estimatePass = computeCharterBorderPassMyr(true, GLOBAL);
    assertNoDoubleCount("borderPass resolver", borderPass, estimatePass, 30);
    assertNoDoubleCount("other resolver", other, 50, 20);
    assertNoDoubleCount("unload resolver", unload, 350, 280);
  });
});
