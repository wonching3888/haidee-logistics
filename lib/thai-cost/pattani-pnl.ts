import {
  computeThaiVehiclePnlForStation,
  type ThaiVehiclePnlDetail,
} from "@/lib/thai-cost/thai-vehicle-pnl";

/** @deprecated Prefer ThaiVehiclePnlDetail — alias kept for summary page imports. */
export type PattaniPnlDetail = ThaiVehiclePnlDetail;

/**
 * Pattani Thai-vehicle PNL (THB).
 * Replaces prior internalCostMyr − realCostMyr snapshot comparison.
 */
export async function getPattaniPnl(
  year: number,
  month: number
): Promise<PattaniPnlDetail> {
  return computeThaiVehiclePnlForStation("PATTANI", year, month);
}
