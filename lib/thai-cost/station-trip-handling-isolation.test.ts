import { describe, expect, it } from "vitest";
import { computeSongkhlaHandlingCommission } from "@/lib/thai-cost/songkhla-handling-cost";
import { computePattaniDayCosts } from "@/lib/thai-cost/rate-settings";
import type { ResolvedThaiCostRates } from "@/lib/thai-cost/rate-settings";

const baseRates: ResolvedThaiCostRates = {
  handlingSmallWeekday: 3,
  handlingSmallHoliday: 5,
  handlingLargeWeekday: 4,
  handlingLargeHoliday: 6,
  driverTripSongkhla: 700,
  driverTripPattani: 1200,
  pattaniContractorCrate: 20,
  pattaniContractorBox: 5,
  pattaniSakriCrate: 2.2,
  songkhlaCrateRate: 2.5,
  songkhlaBoxRate: 1.8,
  largeTongTypeCodes: ["VIO", "BS", "GKS"],
  source: "current_settings",
  yearMonth: "2026-07",
  locked: false,
};

/** Dispatch aggregates feed handling fees; per-trip qty in thai_vehicle_trip_daily is separate. */
describe("station trip vs handling fee isolation", () => {
  const dispatchSongkhla = {
    smallCrateTotalQty: 10,
    largeCrateTotalQty: 5,
    boxTotalQty: 7,
  };

  it("songkhla commission unchanged when trip row qty differs from dispatch totals", () => {
    const fromDispatch = computeSongkhlaHandlingCommission(dispatchSongkhla, {
      rateConfig: baseRates,
    });
    // Trip table might record 70 crates on one run — must not alter handling commission.
    const stillFromDispatch = computeSongkhlaHandlingCommission(dispatchSongkhla, {
      rateConfig: baseRates,
    });
    expect(stillFromDispatch).toEqual(fromDispatch);
    expect(fromDispatch.totalCommissionThb).toBe(50.1);
  });

  it("pattani contractor/sakri costs depend only on dispatch crate/box totals", () => {
    const costs = computePattaniDayCosts(82, 0, baseRates);
    const costsAgain = computePattaniDayCosts(82, 0, baseRates);
    expect(costsAgain).toEqual(costs);
    expect(costs.contractorThb).toBe(1640);
  });
});
