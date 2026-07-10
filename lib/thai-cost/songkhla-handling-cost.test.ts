import { describe, expect, it } from "vitest";
import { computeSadaoHandlingCommission } from "@/lib/thai-cost/sadao-cost";
import { computeSongkhlaHandlingCommission } from "@/lib/thai-cost/songkhla-handling-cost";
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

describe("computeSongkhlaHandlingCommission", () => {
  it("bills (small+large)×crateRate + box×boxRate", () => {
    const result = computeSongkhlaHandlingCommission(
      {
        smallCrateTotalQty: 10,
        largeCrateTotalQty: 5,
        boxTotalQty: 7,
      },
      { rateConfig: baseRates }
    );
    expect(result.crateBillableQty).toBe(15);
    expect(result.boxBillableQty).toBe(7);
    expect(result.totalCommissionThb).toBe(50.1);
  });

  it("accepts totals larger than a typical dispatch auto (manual lock)", () => {
    const result = computeSongkhlaHandlingCommission(
      {
        smallCrateTotalQty: 200,
        largeCrateTotalQty: 0,
        boxTotalQty: 80,
      },
      { rateConfig: baseRates }
    );
    expect(result.crateBillableQty).toBe(200);
    expect(result.boxBillableQty).toBe(80);
    expect(result.totalCommissionThb).toBe(200 * 2.5 + 80 * 1.8);
  });

  it("uses legacy Sadao split when locked snapshot lacks Songkhla unified rates", () => {
    const legacyRates: ResolvedThaiCostRates = {
      ...baseRates,
      source: "monthly_snapshot",
      locked: true,
      songkhlaHandlingLegacy: true,
    };
    const qty = {
      smallCrateTotalQty: 10,
      largeCrateTotalQty: 5,
      boxTotalQty: 7,
    };
    const legacy = computeSadaoHandlingCommission(
      { ...qty, smallCrateNoCheckQty: 0, largeCrateNoCheckQty: 0, boxNoCheckQty: 0 },
      { holidayRate: false, rateConfig: legacyRates }
    );
    const songkhla = computeSongkhlaHandlingCommission(qty, {
      rateConfig: legacyRates,
    });
    expect(songkhla.totalCommissionThb).toBe(legacy.totalCommissionThb);
  });
});
