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
      { smallCrateTotalQty: 10, largeCrateTotalQty: 5, boxTotalQty: 7 },
      { rateConfig: baseRates }
    );
    expect(result.crateBillableQty).toBe(15);
    expect(result.boxBillableQty).toBe(7);
    expect(result.crateCommissionThb).toBe(37.5);
    expect(result.boxCommissionThb).toBe(12.6);
    expect(result.totalCommissionThb).toBe(50.1);
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
      {
        ...qty,
        smallCrateNoCheckQty: 0,
        largeCrateNoCheckQty: 0,
        boxNoCheckQty: 0,
      },
      { holidayRate: false, rateConfig: legacyRates }
    );
    const songkhla = computeSongkhlaHandlingCommission(qty, {
      rateConfig: legacyRates,
    });
    expect(songkhla.totalCommissionThb).toBe(legacy.totalCommissionThb);
    expect(songkhla.crateCommissionThb).toBe(
      legacy.smallCommissionThb + legacy.largeCommissionThb
    );
    expect(songkhla.boxCommissionThb).toBe(legacy.boxCommissionThb);
  });

  it("does not change Sadao commission when Songkhla rates differ", () => {
    const qty = {
      smallCrateTotalQty: 12,
      largeCrateTotalQty: 8,
      boxTotalQty: 3,
      smallCrateNoCheckQty: 0,
      largeCrateNoCheckQty: 0,
      boxNoCheckQty: 0,
    };
    const sadao = computeSadaoHandlingCommission(qty, {
      holidayRate: false,
      rateConfig: baseRates,
    });
    expect(sadao.totalCommissionThb).toBe(12 * 3 + 8 * 4 + 3 * 3);
    const songkhla = computeSongkhlaHandlingCommission(qty, {
      rateConfig: baseRates,
    });
    expect(songkhla.totalCommissionThb).toBe(20 * 2.5 + 3 * 1.8);
    expect(songkhla.totalCommissionThb).not.toBe(sadao.totalCommissionThb);
  });
});
