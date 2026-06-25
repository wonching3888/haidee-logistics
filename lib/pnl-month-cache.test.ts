import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  clearPnlMonthTripsCache,
  pnlMonthTripsCacheKey,
} from "@/lib/pnl-month-cache";
import { reloadTripCostEngineConfig } from "@/lib/trip-cost-engine/config";

describe("pnlMonthTripsCacheKey", () => {
  beforeEach(() => {
    clearPnlMonthTripsCache();
    reloadTripCostEngineConfig({
      VOUCHER_COST_MODE: "legacy",
      VEHICLE_ALLOC_MODE: "legacy",
    });
  });

  afterEach(() => {
    reloadTripCostEngineConfig({
      VOUCHER_COST_MODE: "legacy",
      VEHICLE_ALLOC_MODE: "legacy",
    });
  });

  it("includes voucher and vehicle cost flags in cache key", () => {
    const key = pnlMonthTripsCacheKey({
      year: 2026,
      month: 6,
    });

    expect(key).toContain("voucher:legacy");
    expect(key).toContain("vehicle:legacy");
    expect(key).toBe("2026-6|full|ALL|ALL|voucher:legacy|vehicle:legacy");
  });

  it("changes cache key when cost flags change", () => {
    const legacyKey = pnlMonthTripsCacheKey({ year: 2026, month: 6 });

    reloadTripCostEngineConfig({
      VOUCHER_COST_MODE: "enforced",
      VEHICLE_ALLOC_MODE: "enforced",
    });

    const enforcedKey = pnlMonthTripsCacheKey({ year: 2026, month: 6 });

    expect(legacyKey).not.toBe(enforcedKey);
    expect(enforcedKey).toContain("voucher:enforced");
    expect(enforcedKey).toContain("vehicle:enforced");
  });
});
