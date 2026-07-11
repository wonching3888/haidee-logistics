import {
  computeThaiVehiclePnlForStation,
  type ThaiVehiclePnlDetail,
} from "@/lib/thai-cost/thai-vehicle-pnl";

/** @deprecated Prefer ThaiVehiclePnlDetail — alias kept for summary page imports. */
export type SongkhlaPnlDetail = ThaiVehiclePnlDetail;

/**
 * Songkhla Thai-vehicle PNL (THB).
 * Replaces prior internalCostMyr − realCostMyr snapshot comparison.
 */
export async function getSongkhlaPnl(
  year: number,
  month: number
): Promise<SongkhlaPnlDetail> {
  return computeThaiVehiclePnlForStation("SONGKHLA", year, month);
}
