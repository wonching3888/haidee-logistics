import { describe, expect, it } from "vitest";
import {
  estimateTripUnloadingFeesBreakdown,
  type UnloadingDispatchEstimateInput,
} from "@/lib/driver-expense-service";
import type { UnloadingRateConfigInput } from "@/lib/unloading-calculator";
import {
  isCostEligible,
  resolveVoucherTripCosts,
  type VoucherRouteCostEstimate,
} from "@/lib/trip-cost-engine/voucher-cost-resolver";
import type { VoucherCostContext } from "@/lib/trip-cost-engine/types";
import type { UnloadingFeeCostRow } from "@/lib/unloading-trip-cost";
import { VOUCHER_STATUSES } from "@/lib/driver-voucher-status-types";

const ROUTE_ESTIMATE: VoucherRouteCostEstimate = {
  borderPassMyr: 25,
  parkingMyr: 18,
  fishCheckingMyr: 11,
};

const UNLOADING_ROWS: UnloadingFeeCostRow[] = [
  {
    unloadFee: 30,
    unloadFeeOverride: 35,
    kpbFee: 20,
    kpbFeeOverride: 22,
    isKpbExempt: false,
  },
  {
    unloadFee: 40,
    unloadFeeOverride: null,
    kpbFee: 10,
    kpbFeeOverride: null,
    isKpbExempt: false,
  },
];

const ESTIMATE_KPB = 30;
const ESTIMATE_UNLOAD = 70;
const EFFECTIVE_KPB = 32;
const EFFECTIVE_UNLOAD = 75;

const ROUTE_DISPATCH_ESTIMATE: UnloadingDispatchEstimateInput = {
  truck: { type: "10-wheeler" },
  lines: [
    {
      inboundLine: {
        dispatchStatus: "assigned",
        quantity: 80,
        mcDeliveryMode: null,
        stall: { code: "BM-01", market: { code: "BM" } },
        tongType: { code: "A002", isBox: false },
      },
    },
  ],
};

const ROUTE_RATES = new Map<string, UnloadingRateConfigInput>([
  [
    "BM",
    {
      market: "BM",
      smallCrate: 0.55,
      largeCrate: 0.65,
      box: 0.45,
      kpbSmall: 18,
      kpbLarge: 22,
      kpbBox: 12,
      kpbMode: "per_trip",
      unloadMode: "per_crate",
    },
  ],
]);

function voucher(
  overrides: Partial<VoucherCostContext> & { status: string }
): VoucherCostContext {
  return {
    costAppliedAt: null,
    chopBorderAmt: 99,
    chopBorderActual: 27,
    parkingAmt: 99,
    parkingActual: 20,
    fishCheckAmt: 99,
    fishCheckActual: 12,
    kpbActual: 99,
    upahTurunActual: 99,
    ...overrides,
  };
}

describe("isCostEligible", () => {
  it("is true only for confirmed/approved with cost_applied_at", () => {
    const applied = new Date("2026-06-15T10:00:00Z");
    expect(isCostEligible("confirmed", applied)).toBe(true);
    expect(isCostEligible("approved", applied)).toBe(true);
  });

  it("is false without cost_applied_at or for non-final statuses", () => {
    const applied = new Date("2026-06-15T10:00:00Z");
    for (const status of VOUCHER_STATUSES) {
      if (status === "confirmed" || status === "approved") continue;
      expect(isCostEligible(status, applied)).toBe(false);
      expect(isCostEligible(status, null)).toBe(false);
    }
    expect(isCostEligible("confirmed", null)).toBe(false);
    expect(isCostEligible("approved", null)).toBe(false);
  });
});

describe("resolveVoucherTripCosts", () => {
  const applied = new Date("2026-06-15T10:00:00Z");

  it("eligible confirmed reads voucher actuals and unloading overrides (not *Amt)", () => {
    const result = resolveVoucherTripCosts({
      voucher: voucher({
        status: "confirmed",
        costAppliedAt: applied,
        chopBorderActual: 27,
        parkingActual: 20,
        fishCheckActual: 12,
      }),
      routeEstimate: ROUTE_ESTIMATE,
      unloadingRows: UNLOADING_ROWS,
    });

    expect(result.costEligible).toBe(true);
    expect(result.chopBorderMyr).toBe(27);
    expect(result.parkingMyr).toBe(20);
    expect(result.fishCheckMyr).toBe(12);
    expect(result.kpbMyr).toBe(EFFECTIVE_KPB);
    expect(result.upahTurunMyr).toBe(EFFECTIVE_UNLOAD);
    expect(result.sources.chopBorder).toBe("actual");
    expect(result.sources.parking).toBe("actual");
    expect(result.sources.fishCheck).toBe("actual");
    expect(result.sources.kpb).toBe("override");
    expect(result.sources.upahTurun).toBe("override");
    expect(result.loadUnloadMyr).toBe(EFFECTIVE_KPB + EFFECTIVE_UNLOAD);
  });

  it("eligible approved matches confirmed cost reads", () => {
    const confirmed = resolveVoucherTripCosts({
      voucher: voucher({ status: "confirmed", costAppliedAt: applied }),
      routeEstimate: ROUTE_ESTIMATE,
      unloadingRows: UNLOADING_ROWS,
    });
    const approved = resolveVoucherTripCosts({
      voucher: voucher({ status: "approved", costAppliedAt: applied }),
      routeEstimate: ROUTE_ESTIMATE,
      unloadingRows: UNLOADING_ROWS,
    });
    expect(approved).toEqual(confirmed);
  });

  it("pending_review ignores actuals and overrides even with cost_applied_at set", () => {
    const result = resolveVoucherTripCosts({
      voucher: voucher({
        status: "pending_review",
        costAppliedAt: applied,
      }),
      routeEstimate: ROUTE_ESTIMATE,
      unloadingRows: UNLOADING_ROWS,
    });

    expect(result.costEligible).toBe(false);
    expect(result.chopBorderMyr).toBe(ROUTE_ESTIMATE.borderPassMyr);
    expect(result.parkingMyr).toBe(ROUTE_ESTIMATE.parkingMyr);
    expect(result.fishCheckMyr).toBe(ROUTE_ESTIMATE.fishCheckingMyr);
    expect(result.kpbMyr).toBe(ESTIMATE_KPB);
    expect(result.upahTurunMyr).toBe(ESTIMATE_UNLOAD);
    expect(result.sources).toMatchObject({
      chopBorder: "estimate",
      parking: "estimate",
      fishCheck: "estimate",
      kpb: "estimate",
      upahTurun: "estimate",
      loadUnload: "estimate",
    });
  });

  it("rejected ignores actuals and overrides", () => {
    const result = resolveVoucherTripCosts({
      voucher: voucher({
        status: "rejected",
        costAppliedAt: null,
      }),
      routeEstimate: ROUTE_ESTIMATE,
      unloadingRows: UNLOADING_ROWS,
    });

    expect(result.costEligible).toBe(false);
    expect(result.kpbMyr).toBe(ESTIMATE_KPB);
    expect(result.upahTurunMyr).toBe(ESTIMATE_UNLOAD);
    expect(result.parkingMyr).toBe(ROUTE_ESTIMATE.parkingMyr);
  });

  it.each([
    "draft",
    "clerk_entered",
    "pending_review",
    "rejected",
  ] as const)("status %s always uses estimates", (status) => {
    const result = resolveVoucherTripCosts({
      voucher: voucher({
        status,
        costAppliedAt: status === "pending_review" ? applied : null,
      }),
      routeEstimate: ROUTE_ESTIMATE,
      unloadingRows: UNLOADING_ROWS,
    });

    expect(result.costEligible).toBe(false);
    expect(result.kpbMyr).toBe(ESTIMATE_KPB);
    expect(result.upahTurunMyr).toBe(ESTIMATE_UNLOAD);
    expect(result.sources.kpb).toBe("estimate");
    expect(result.sources.upahTurun).toBe("estimate");
  });

  it("confirmed without cost_applied_at stays on estimates", () => {
    const result = resolveVoucherTripCosts({
      voucher: voucher({
        status: "confirmed",
        costAppliedAt: null,
        parkingActual: 99,
      }),
      routeEstimate: ROUTE_ESTIMATE,
      unloadingRows: UNLOADING_ROWS,
    });

    expect(result.costEligible).toBe(false);
    expect(result.parkingMyr).toBe(ROUTE_ESTIMATE.parkingMyr);
    expect(result.kpbMyr).toBe(ESTIMATE_KPB);
  });

  it("eligible falls back to route estimate when actual is null", () => {
    const result = resolveVoucherTripCosts({
      voucher: voucher({
        status: "confirmed",
        costAppliedAt: applied,
        chopBorderActual: null,
        parkingActual: null,
        fishCheckActual: null,
      }),
      routeEstimate: ROUTE_ESTIMATE,
      unloadingRows: [
        {
          unloadFee: 10,
          unloadFeeOverride: null,
          kpbFee: 5,
          kpbFeeOverride: null,
          isKpbExempt: false,
        },
      ],
    });

    expect(result.chopBorderMyr).toBe(ROUTE_ESTIMATE.borderPassMyr);
    expect(result.parkingMyr).toBe(ROUTE_ESTIMATE.parkingMyr);
    expect(result.fishCheckMyr).toBe(ROUTE_ESTIMATE.fishCheckingMyr);
    expect(result.sources.chopBorder).toBe("estimate");
    expect(result.sources.kpb).toBe("estimate");
  });

  it("null voucher uses all estimates", () => {
    const result = resolveVoucherTripCosts({
      voucher: null,
      routeEstimate: ROUTE_ESTIMATE,
      unloadingRows: UNLOADING_ROWS,
    });

    expect(result.costEligible).toBe(false);
    expect(result.chopBorderMyr).toBe(25);
    expect(result.kpbMyr).toBe(ESTIMATE_KPB);
  });

  it("null voucher with no stored rows uses route/rate estimate (not zero)", () => {
    const routeBreakdown = estimateTripUnloadingFeesBreakdown(
      ROUTE_DISPATCH_ESTIMATE,
      ROUTE_RATES
    );
    expect(routeBreakdown.kpbMyr + routeBreakdown.upahTurunMyr).toBeGreaterThan(0);

    const result = resolveVoucherTripCosts({
      voucher: null,
      routeEstimate: ROUTE_ESTIMATE,
      unloadingRows: [],
      dispatchEstimate: ROUTE_DISPATCH_ESTIMATE,
      ratesByMarket: ROUTE_RATES,
    });

    expect(result.costEligible).toBe(false);
    expect(result.kpbMyr).toBe(routeBreakdown.kpbMyr);
    expect(result.upahTurunMyr).toBe(routeBreakdown.upahTurunMyr);
    expect(result.loadUnloadMyr).toBe(
      routeBreakdown.kpbMyr + routeBreakdown.upahTurunMyr
    );
    expect(result.sources.kpb).toBe("estimate");
    expect(result.sources.upahTurun).toBe("estimate");
  });

  it("unreviewed voucher with no stored rows uses route estimate (matches legacy continuity)", () => {
    const routeBreakdown = estimateTripUnloadingFeesBreakdown(
      ROUTE_DISPATCH_ESTIMATE,
      ROUTE_RATES
    );

    const result = resolveVoucherTripCosts({
      voucher: voucher({ status: "pending_review" }),
      routeEstimate: ROUTE_ESTIMATE,
      unloadingRows: [],
      dispatchEstimate: ROUTE_DISPATCH_ESTIMATE,
      ratesByMarket: ROUTE_RATES,
    });

    expect(result.costEligible).toBe(false);
    expect(result.loadUnloadMyr).toBe(
      routeBreakdown.kpbMyr + routeBreakdown.upahTurunMyr
    );
    expect(result.loadUnloadMyr).toBeGreaterThan(0);
  });

  it("no voucher and no route estimate inputs still returns zero load/unload", () => {
    const result = resolveVoucherTripCosts({
      voucher: null,
      routeEstimate: ROUTE_ESTIMATE,
      unloadingRows: [],
    });

    expect(result.loadUnloadMyr).toBe(0);
  });

  describe("table: status × override × actual × cost_applied_at", () => {
    const statuses = VOUCHER_STATUSES;
    const cases = statuses.flatMap((status) =>
      [null, applied].flatMap((costAppliedAt) =>
        [false, true].flatMap((hasOverride) =>
          [false, true].map((hasActual) => ({
            status,
            costAppliedAt,
            hasOverride,
            hasActual,
          }))
        )
      )
    );

    it.each(cases)(
      "status=$status applied=$costAppliedAt override=$hasOverride actual=$hasActual",
      ({ status, costAppliedAt, hasOverride, hasActual }) => {
        const rows: UnloadingFeeCostRow[] = hasOverride
          ? UNLOADING_ROWS
          : [
              {
                unloadFee: 30,
                unloadFeeOverride: null,
                kpbFee: 20,
                kpbFeeOverride: null,
                isKpbExempt: false,
              },
            ];

        const result = resolveVoucherTripCosts({
          voucher: voucher({
            status,
            costAppliedAt,
            parkingActual: hasActual ? 20 : null,
            chopBorderActual: hasActual ? 27 : null,
            fishCheckActual: hasActual ? 12 : null,
          }),
          routeEstimate: ROUTE_ESTIMATE,
          unloadingRows: rows,
        });

        const shouldReadReal =
          (status === "confirmed" || status === "approved") &&
          costAppliedAt != null;

        if (shouldReadReal) {
          expect(result.costEligible).toBe(true);
          if (hasActual) {
            expect(result.parkingMyr).toBe(20);
            expect(result.sources.parking).toBe("actual");
          } else {
            expect(result.parkingMyr).toBe(ROUTE_ESTIMATE.parkingMyr);
            expect(result.sources.parking).toBe("estimate");
          }
          if (hasOverride) {
            expect(result.sources.kpb).toBe("override");
            expect(result.kpbMyr).toBe(hasOverride ? EFFECTIVE_KPB : 20);
          } else {
            expect(result.sources.kpb).toBe("estimate");
          }
        } else {
          expect(result.costEligible).toBe(false);
          expect(result.parkingMyr).toBe(ROUTE_ESTIMATE.parkingMyr);
          expect(result.kpbMyr).toBe(
            rows.reduce((s, r) => s + (r.isKpbExempt ? 0 : r.kpbFee), 0)
          );
          expect(result.sources.parking).toBe("estimate");
          expect(result.sources.kpb).toBe("estimate");
          expect(result.sources.upahTurun).toBe("estimate");
        }
      }
    );
  });
});
