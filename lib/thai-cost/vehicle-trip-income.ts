/**
 * Vehicle trip income from Thai-segment fixed freight rates (THB).
 * Same rates as thai-segment-freight.ts / global_cost_settings.
 */
import type { ThaiSegmentRates } from "@/lib/constants/thai-segment-rates";
import type { ThaiVehicleStation } from "@/lib/thai-cost/vehicle-trip-cost";

export interface VehicleTripCargoQty {
  tongQty: number;
  boxQty: number;
}

export function computeVehicleTripIncomeThb(
  station: ThaiVehicleStation,
  cargo: VehicleTripCargoQty,
  rates: ThaiSegmentRates
): number {
  const tongQty = Math.max(0, cargo.tongQty);
  const boxQty = Math.max(0, cargo.boxQty);
  if (tongQty === 0 && boxQty === 0) return 0;

  if (station === "SONGKHLA") {
    return (
      Math.round(
        (tongQty * rates.songkhlaRateTong + boxQty * rates.songkhlaRateBox) *
          100
      ) / 100
    );
  }
  return (
    Math.round(
      (tongQty * rates.pattaniRateTong + boxQty * rates.pattaniRateBox) * 100
    ) / 100
  );
}
