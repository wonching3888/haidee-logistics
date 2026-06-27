import { describe, expect, it, vi, beforeEach } from "vitest";
import { invalidatePnlTripsCache } from "@/lib/pnl-cache-invalidation";
import {
  clearPnlMonthTripsCache,
  setCachedPnlMonthTrips,
  getCachedPnlMonthTrips,
  pnlMonthTripsCacheKey,
} from "@/lib/pnl-month-cache";

const mockRevalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

describe("invalidatePnlTripsCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPnlMonthTripsCache();
  });

  it("clears pnl month trips cache", () => {
    const key = pnlMonthTripsCacheKey({ year: 2026, month: 6 });
    setCachedPnlMonthTrips(key, {
      drivers: [],
      trips: [],
      tripTotals: {
        revenueMyr: 1,
        directCostMyr: 0,
        allocatedCostMyr: 0,
        totalCostMyr: 0,
        grossProfitMyr: 0,
        marginPct: 0,
        tripCount: 1,
        totalQuantity: 0,
        totalBarrelQty: 0,
        totalBoxQty: 0,
      },
    });
    expect(getCachedPnlMonthTrips(key)).not.toBeNull();

    invalidatePnlTripsCache();

    expect(getCachedPnlMonthTrips(key)).toBeNull();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/reports/pnl");
  });
});
