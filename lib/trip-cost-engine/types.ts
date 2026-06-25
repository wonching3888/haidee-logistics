import type { RouteMasterCostRow, TripRouteCosts } from "@/lib/trip-route-cost";
import type { TripCostMode } from "@/lib/trip-cost-engine/config";

/** Shared input for per-trip cost resolution (Steps 2A–7). */
export interface TripCostInput {
  tripId: string;
  dispatchMarkets: string[];
  effectiveMarkets: string[];
  routes: RouteMasterCostRow[];
  globalCosts: {
    borderPass: number;
    epermit: number;
    dagangNet: number;
    forwardingOutbound: number;
    fuelPriceMyr: number;
  };
  tollClass?: string | null;
  truck?: {
    fuelEfficiencyKmPerL: number | null;
    annualMileageKm: number | null;
    costItems: { annualAmount: number }[];
  } | null;
  /** Assigned inbound quantity per line (barrels/boxes). */
  lines: TripCostLineInput[];
  voucherCostContext?: VoucherCostContext | null;
}

export interface TripCostLineInput {
  lineId: string;
  marketCode: string;
  quantity: number;
  shipperId: string;
  /** When true, line is excluded from vehicle/toll allocation (MC third-party). */
  excludeFromVehicleAllocation?: boolean;
  /** Quantity used for unload-fee allocation denominator. */
  unloadAllocatableQuantity?: number;
}

/** Voucher gate context for cost-eligible actuals (Step 2A). */
export interface VoucherCostContext {
  status: string;
  costAppliedAt: Date | null;
  chopBorderAmt: number | null;
  chopBorderActual: number | null;
  parkingAmt: number | null;
  parkingActual: number | null;
  fishCheckAmt: number | null;
  fishCheckActual: number | null;
  kpbActual: number | null;
  upahTurunActual: number | null;
}

/** Per-line allocated vehicle + global trip costs (Step 4 output shape). */
export interface LineAllocation {
  lineId: string;
  shipperId: string;
  marketCode: string;
  quantity: number;
  fuelMyr: number;
  maintenanceMyr: number;
  tollMyr: number;
  borderPassMyr: number;
  fishCheckingMyr: number;
  parkingMyr: number;
  epermitMyr: number;
  dagangNetMyr: number;
  forwardingMyr: number;
  driverMyr: number;
  unloadFeeMyr: number;
  totalAllocatedMyr: number;
}

export interface TripVehiclePool {
  routeCosts: TripRouteCosts;
  fuelMyr: number;
  maintenanceMyr: number;
  tripMileageKm: number;
}

export interface LegacyTripVehicleAllocation {
  quantity: number;
  fuelMyr: number;
  maintenanceMyr: number;
  tollMyr: number;
  borderPassMyr: number;
  fishCheckingMyr: number;
  parkingMyr: number;
  epermitMyr: number;
  dagangNetMyr: number;
  forwardingMyr: number;
  driverMyr: number;
  allocatedCostMyr: number;
}

export type TripCostEngineModeSnapshot = {
  voucherCostMode: TripCostMode;
  vehicleAllocMode: TripCostMode;
};
