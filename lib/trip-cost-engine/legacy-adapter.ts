/**
 * Legacy baseline: thin wrappers around today's production formulas.
 * Mirrors lib/operations-cost.ts + lib/pnl-report.ts allocateShare paths.
 * Not wired into P&L/operations until Step 7 (enforced).
 */
import type { RouteMasterCostRow, TripRouteCosts } from "@/lib/trip-route-cost";
import {
  computeTripRouteCosts,
  computeTripTruckCosts,
  findApplicableRoutes,
} from "@/lib/trip-route-cost";
import type {
  LegacyTripVehicleAllocation,
  TripVehiclePool,
} from "@/lib/trip-cost-engine/types";

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Same formula as lib/pnl-report.ts allocateShare (private). */
export function legacyAllocateShare(
  part: number,
  total: number,
  amount: number
): number {
  if (total <= 0 || amount <= 0 || part <= 0) return 0;
  return roundMoney((part / total) * amount);
}

export function legacyResolveTripRouteCosts(
  dispatchMarkets: string[],
  routes: RouteMasterCostRow[],
  globalCosts: {
    borderPass: number;
    epermit: number;
    dagangNet: number;
    forwardingOutbound: number;
  },
  tollClass?: string | null
): TripRouteCosts {
  const applicableRoutes = findApplicableRoutes(dispatchMarkets, routes);
  return computeTripRouteCosts(applicableRoutes, globalCosts, tollClass);
}

export function legacyResolveTripVehiclePool(input: {
  dispatchMarkets: string[];
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
}): TripVehiclePool {
  const routeCosts = legacyResolveTripRouteCosts(
    input.dispatchMarkets,
    input.routes,
    input.globalCosts,
    input.tollClass
  );

  const truckCosts = input.truck
    ? computeTripTruckCosts(
        routeCosts.tripMileageKm,
        input.truck,
        input.globalCosts.fuelPriceMyr
      )
    : { fuelMyr: 0, maintenanceMyr: 0 };

  return {
    routeCosts,
    fuelMyr: truckCosts.fuelMyr,
    maintenanceMyr: truckCosts.maintenanceMyr,
    tripMileageKm: routeCosts.tripMileageKm,
  };
}

/** Trip-level fixed fees allocated like pnl-report tripAllocated (excl. load/unload). */
export function legacyBuildTripAllocatedPool(input: {
  vehiclePool: TripVehiclePool;
  borderPassMyr: number;
  fishCheckingMyr: number;
  parkingMyr: number;
  driverMyr: number;
}) {
  const { routeCosts, fuelMyr, maintenanceMyr } = input.vehiclePool;
  return {
    fuelMyr,
    maintenanceMyr,
    tollMyr: routeCosts.tollFee,
    borderPassMyr: input.borderPassMyr,
    fishCheckingMyr: input.fishCheckingMyr,
    parkingMyr: input.parkingMyr,
    epermitMyr: routeCosts.epermit,
    dagangNetMyr: routeCosts.dagangNet,
    forwardingMyr: routeCosts.forwarding,
    driverMyr: input.driverMyr,
  };
}

/**
 * Shipper-level vehicle/global allocation (current pnl-report computeTripPnlRow).
 * vehicleAllocationDenominator = sum of all line quantities on the trip.
 */
export function legacyAllocateTripVehicleCosts(input: {
  quantity: number;
  vehicleAllocationDenominator: number;
  tripAllocated: ReturnType<typeof legacyBuildTripAllocatedPool>;
}): LegacyTripVehicleAllocation {
  const { quantity, vehicleAllocationDenominator, tripAllocated } = input;
  const allocatedFuelMyr = legacyAllocateShare(
    quantity,
    vehicleAllocationDenominator,
    tripAllocated.fuelMyr
  );
  const allocatedMaintenanceMyr = legacyAllocateShare(
    quantity,
    vehicleAllocationDenominator,
    tripAllocated.maintenanceMyr
  );
  const allocatedTollMyr = legacyAllocateShare(
    quantity,
    vehicleAllocationDenominator,
    tripAllocated.tollMyr
  );
  const allocatedBorderPassMyr = legacyAllocateShare(
    quantity,
    vehicleAllocationDenominator,
    tripAllocated.borderPassMyr
  );
  const allocatedFishCheckingMyr = legacyAllocateShare(
    quantity,
    vehicleAllocationDenominator,
    tripAllocated.fishCheckingMyr
  );
  const allocatedParkingMyr = legacyAllocateShare(
    quantity,
    vehicleAllocationDenominator,
    tripAllocated.parkingMyr
  );
  const allocatedEpermitMyr = legacyAllocateShare(
    quantity,
    vehicleAllocationDenominator,
    tripAllocated.epermitMyr
  );
  const allocatedDagangNetMyr = legacyAllocateShare(
    quantity,
    vehicleAllocationDenominator,
    tripAllocated.dagangNetMyr
  );
  const allocatedForwardingMyr = legacyAllocateShare(
    quantity,
    vehicleAllocationDenominator,
    tripAllocated.forwardingMyr
  );
  const allocatedDriverMyr = legacyAllocateShare(
    quantity,
    vehicleAllocationDenominator,
    tripAllocated.driverMyr
  );
  const allocatedCostMyr = roundMoney(
    allocatedFuelMyr +
      allocatedMaintenanceMyr +
      allocatedTollMyr +
      allocatedBorderPassMyr +
      allocatedFishCheckingMyr +
      allocatedParkingMyr +
      allocatedEpermitMyr +
      allocatedDagangNetMyr +
      allocatedForwardingMyr +
      allocatedDriverMyr
  );

  return {
    quantity,
    fuelMyr: allocatedFuelMyr,
    maintenanceMyr: allocatedMaintenanceMyr,
    tollMyr: allocatedTollMyr,
    borderPassMyr: allocatedBorderPassMyr,
    fishCheckingMyr: allocatedFishCheckingMyr,
    parkingMyr: allocatedParkingMyr,
    epermitMyr: allocatedEpermitMyr,
    dagangNetMyr: allocatedDagangNetMyr,
    forwardingMyr: allocatedForwardingMyr,
    driverMyr: allocatedDriverMyr,
    allocatedCostMyr,
  };
}
