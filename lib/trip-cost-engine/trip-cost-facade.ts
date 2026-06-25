/**
 * Step 7a: unified trip cost entry for P&L and operations.
 * Default flags → legacy adapters (production-identical output).
 * Enforced flags → leg allocator + voucher gate (wired, not enabled in prod).
 */
import type { UnloadingDispatchEstimateInput } from "@/lib/driver-expense-service";
import type { UnloadingRateConfigInput } from "@/lib/unloading-calculator";
import {
  isVehicleAllocEnforced,
  isVoucherCostEnforced,
} from "@/lib/trip-cost-engine/config";
import {
  allocateTripLineCosts,
  assertTripVehicleAllocationConserved,
  type TripGlobalFeePool,
} from "@/lib/trip-cost-engine/line-cost-allocator";
import { getRouteGroups } from "@/lib/payroll-route-label";
import {
  legacyAllocateTripVehicleCosts,
  legacyBuildTripAllocatedPool,
  legacyResolveTripVehiclePool,
} from "@/lib/trip-cost-engine/legacy-adapter";
import type {
  LegacyTripVehicleAllocation,
  TripCostLineInput,
  TripVehiclePool,
  VoucherCostContext,
} from "@/lib/trip-cost-engine/types";
import {
  resolveVoucherTripCosts,
  type VoucherRouteCostEstimate,
} from "@/lib/trip-cost-engine/voucher-cost-resolver";
import { buildVehicleLegPlan } from "@/lib/trip-cost-engine/vehicle-leg-resolver";
import type { GlobalTripCostValues } from "@/lib/operations-cost";
import type { RouteMasterCostRow, TripRouteCosts } from "@/lib/trip-route-cost";
import {
  resolveTripLoadUnloadCost,
  type CrateLoadingFeeCostRow,
  type UnloadingFeeCostRow,
} from "@/lib/unloading-trip-cost";

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export interface TripAllocatedPool {
  fuelMyr: number;
  maintenanceMyr: number;
  tollMyr: number;
  borderPassMyr: number;
  fishCheckingMyr: number;
  parkingMyr: number;
  loadUnloadMyr: number;
  epermitMyr: number;
  dagangNetMyr: number;
  forwardingMyr: number;
  driverMyr: number;
}

export interface ResolveTripAllocatedPoolInput {
  effectiveMarkets: string[];
  routeGroups: string[];
  routes: RouteMasterCostRow[];
  globalCosts: GlobalTripCostValues;
  tollClass?: string | null;
  truck?: {
    fuelEfficiencyKmPerL: number | null;
    annualMileageKm: number | null;
    costItems: { annualAmount: number }[];
  } | null;
  voucher?: VoucherCostContext | null;
  unloadingRows: UnloadingFeeCostRow[];
  loadingRows: CrateLoadingFeeCostRow[];
  dispatchEstimate: UnloadingDispatchEstimateInput;
  ratesByMarket: Map<string, UnloadingRateConfigInput>;
  driverMyr: number;
  costLines?: TripCostLineInput[];
}

export interface ResolveTripAllocatedPoolResult {
  pool: TripAllocatedPool;
  vehiclePool: TripVehiclePool;
  routeCosts: TripRouteCosts;
  lineAllocationsByShipper?: Map<string, LegacyTripVehicleAllocation>;
}

function legacyVoucherScalars(
  voucher: VoucherCostContext | null | undefined,
  routeCosts: TripRouteCosts
) {
  return {
    borderPassMyr:
      voucher?.chopBorderActual ??
      voucher?.chopBorderAmt ??
      routeCosts.borderPass,
    parkingMyr:
      voucher?.parkingActual ?? voucher?.parkingAmt ?? routeCosts.parkingFee,
    fishCheckingMyr:
      voucher?.fishCheckActual ??
      voucher?.fishCheckAmt ??
      routeCosts.fishCheckingFee,
    loadUnloadMyr: 0 as number,
  };
}

function resolveLegacyLoadUnloadMyr(input: ResolveTripAllocatedPoolInput) {
  return resolveTripLoadUnloadCost({
    unloadingRows: input.unloadingRows,
    loadingRows: input.loadingRows,
    dispatchEstimate: input.dispatchEstimate,
    ratesByMarket: input.ratesByMarket,
  });
}

function resolveEnforcedVoucherCosts(
  input: ResolveTripAllocatedPoolInput,
  routeCosts: TripRouteCosts,
  globalCosts: GlobalTripCostValues
) {
  const routeEstimate: VoucherRouteCostEstimate = {
    borderPassMyr: globalCosts.borderPass,
    parkingMyr: routeCosts.parkingFee,
    fishCheckingMyr: routeCosts.fishCheckingFee,
  };
  return resolveVoucherTripCosts({
    voucher: input.voucher ?? null,
    routeEstimate,
    unloadingRows: input.unloadingRows,
    loadingRows: input.loadingRows,
    dispatchEstimate: input.dispatchEstimate,
    ratesByMarket: input.ratesByMarket,
  });
}

function aggregateShipperAllocations(
  allocations: ReturnType<typeof allocateTripLineCosts>["allocations"]
): Map<string, LegacyTripVehicleAllocation> {
  const byShipper = new Map<
    string,
    {
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
    }
  >();

  for (const row of allocations) {
    const existing = byShipper.get(row.shipperId) ?? {
      quantity: 0,
      fuelMyr: 0,
      maintenanceMyr: 0,
      tollMyr: 0,
      borderPassMyr: 0,
      fishCheckingMyr: 0,
      parkingMyr: 0,
      epermitMyr: 0,
      dagangNetMyr: 0,
      forwardingMyr: 0,
      driverMyr: 0,
    };
    existing.quantity += row.quantity;
    existing.fuelMyr = roundMoney(existing.fuelMyr + row.fuelMyr);
    existing.maintenanceMyr = roundMoney(existing.maintenanceMyr + row.maintenanceMyr);
    existing.tollMyr = roundMoney(existing.tollMyr + row.tollMyr);
    existing.borderPassMyr = roundMoney(existing.borderPassMyr + row.borderPassMyr);
    existing.fishCheckingMyr = roundMoney(
      existing.fishCheckingMyr + row.fishCheckingMyr
    );
    existing.parkingMyr = roundMoney(existing.parkingMyr + row.parkingMyr);
    existing.epermitMyr = roundMoney(existing.epermitMyr + row.epermitMyr);
    existing.dagangNetMyr = roundMoney(existing.dagangNetMyr + row.dagangNetMyr);
    existing.forwardingMyr = roundMoney(existing.forwardingMyr + row.forwardingMyr);
    existing.driverMyr = roundMoney(existing.driverMyr + row.driverMyr);
    byShipper.set(row.shipperId, existing);
  }

  const result = new Map<string, LegacyTripVehicleAllocation>();
  for (const [shipperId, row] of Array.from(byShipper.entries())) {
    const allocatedCostMyr = roundMoney(
      row.fuelMyr +
        row.maintenanceMyr +
        row.tollMyr +
        row.borderPassMyr +
        row.fishCheckingMyr +
        row.parkingMyr +
        row.epermitMyr +
        row.dagangNetMyr +
        row.forwardingMyr +
        row.driverMyr
    );
    result.set(shipperId, {
      quantity: row.quantity,
      fuelMyr: row.fuelMyr,
      maintenanceMyr: row.maintenanceMyr,
      tollMyr: row.tollMyr,
      borderPassMyr: row.borderPassMyr,
      fishCheckingMyr: row.fishCheckingMyr,
      parkingMyr: row.parkingMyr,
      epermitMyr: row.epermitMyr,
      dagangNetMyr: row.dagangNetMyr,
      forwardingMyr: row.forwardingMyr,
      driverMyr: row.driverMyr,
      allocatedCostMyr,
    });
  }
  return result;
}

/** Trip-level cost pool for P&L / operations (legacy or enforced). */
export function resolveTripAllocatedPool(
  input: ResolveTripAllocatedPoolInput
): ResolveTripAllocatedPoolResult {
  const useEnforcedVehicle = isVehicleAllocEnforced();
  const useEnforcedVoucher = isVoucherCostEnforced();

  const vehiclePool = legacyResolveTripVehiclePool({
    dispatchMarkets: input.effectiveMarkets,
    routes: input.routes,
    globalCosts: input.globalCosts,
    tollClass: input.tollClass,
    truck: input.truck,
  });
  const routeCosts = vehiclePool.routeCosts;

  let fuelMyr = vehiclePool.fuelMyr;
  let maintenanceMyr = vehiclePool.maintenanceMyr;
  let tollMyr = routeCosts.tollFee;
  let borderPassMyr: number;
  let fishCheckingMyr: number;
  let parkingMyr: number;
  let loadUnloadMyr: number;
  let lineAllocationsByShipper: Map<string, LegacyTripVehicleAllocation> | undefined;

  if (useEnforcedVoucher) {
    const resolved = resolveEnforcedVoucherCosts(input, routeCosts, input.globalCosts);
    borderPassMyr = resolved.chopBorderMyr;
    fishCheckingMyr = resolved.fishCheckMyr;
    parkingMyr = resolved.parkingMyr;
    loadUnloadMyr = resolved.loadUnloadMyr;
  } else {
    const legacyScalars = legacyVoucherScalars(input.voucher, routeCosts);
    borderPassMyr = legacyScalars.borderPassMyr;
    fishCheckingMyr = legacyScalars.fishCheckingMyr;
    parkingMyr = legacyScalars.parkingMyr;
    loadUnloadMyr = resolveLegacyLoadUnloadMyr(input);
  }

  if (useEnforcedVehicle && input.truck && input.costLines?.length) {
    // Leg plan follows effectiveMarkets (shadow/legacy/allocator), not dispatch.markets.
    // MC all-third-party trips drop MC from effectiveMarkets — avoids orphan MC legs in pool.
    const vehicleRouteGroups = getRouteGroups(input.effectiveMarkets);
    const legPlan = buildVehicleLegPlan({
      routeGroups: vehicleRouteGroups,
      routes: input.routes,
      tollClass: input.tollClass,
      fuelPriceMyr: input.globalCosts.fuelPriceMyr,
      truck: input.truck,
    });
    fuelMyr = legPlan.totalFuelMyr;
    maintenanceMyr = legPlan.totalMaintenanceMyr;
    tollMyr = legPlan.totalTollMyr;

    const globalFees: TripGlobalFeePool = {
      borderPassMyr,
      fishCheckingMyr,
      epermitMyr: routeCosts.epermit,
      dagangNetMyr: routeCosts.dagangNet,
      forwardingMyr: routeCosts.forwarding,
      driverMyr: input.driverMyr,
    };
    const allocationResult = allocateTripLineCosts({
      lines: input.costLines,
      legPlan,
      globalFees,
    });
    lineAllocationsByShipper = aggregateShipperAllocations(
      allocationResult.allocations
    );

    assertTripVehicleAllocationConserved(allocationResult, {
      fuelMyr,
      maintenanceMyr,
      tollMyr,
      borderPassMyr,
      fishCheckingMyr,
      epermitMyr: routeCosts.epermit,
      dagangNetMyr: routeCosts.dagangNet,
      forwardingMyr: routeCosts.forwarding,
      driverMyr: input.driverMyr,
    });
  }

  const pool: TripAllocatedPool = {
    fuelMyr,
    maintenanceMyr,
    tollMyr,
    borderPassMyr,
    fishCheckingMyr,
    parkingMyr,
    loadUnloadMyr,
    epermitMyr: routeCosts.epermit,
    dagangNetMyr: routeCosts.dagangNet,
    forwardingMyr: routeCosts.forwarding,
    driverMyr: input.driverMyr,
  };

  return {
    pool,
    vehiclePool: {
      ...vehiclePool,
      fuelMyr,
      maintenanceMyr,
      routeCosts: {
        ...routeCosts,
        tollFee: tollMyr,
      },
    },
    routeCosts: {
      ...routeCosts,
      tollFee: tollMyr,
    },
    lineAllocationsByShipper,
  };
}

export function sumTripAllocatedWithoutLoadUnload(pool: TripAllocatedPool) {
  return roundMoney(
    pool.fuelMyr +
      pool.maintenanceMyr +
      pool.tollMyr +
      pool.borderPassMyr +
      pool.fishCheckingMyr +
      pool.parkingMyr +
      pool.epermitMyr +
      pool.dagangNetMyr +
      pool.forwardingMyr +
      pool.driverMyr
  );
}

export function allocateShipperVehicleCosts(input: {
  shipperId: string;
  quantity: number;
  vehicleAllocationDenominator: number;
  tripAllocated: ReturnType<typeof legacyBuildTripAllocatedPool>;
  enforcedByShipper?: Map<string, LegacyTripVehicleAllocation>;
}): LegacyTripVehicleAllocation {
  if (isVehicleAllocEnforced() && input.enforcedByShipper) {
    const enforced = input.enforcedByShipper.get(input.shipperId);
    if (enforced) return enforced;
    return {
      quantity: input.quantity,
      fuelMyr: 0,
      maintenanceMyr: 0,
      tollMyr: 0,
      borderPassMyr: 0,
      fishCheckingMyr: 0,
      parkingMyr: 0,
      epermitMyr: 0,
      dagangNetMyr: 0,
      forwardingMyr: 0,
      driverMyr: 0,
      allocatedCostMyr: 0,
    };
  }

  return legacyAllocateTripVehicleCosts({
    quantity: input.quantity,
    vehicleAllocationDenominator: input.vehicleAllocationDenominator,
    tripAllocated: input.tripAllocated,
  });
}

export function allocateShipperVehicleTotalMyr(input: {
  shipperId: string;
  quantity: number;
  vehicleAllocationDenominator: number;
  tripAllocatedWithoutLoadUnload: number;
  enforcedByShipper?: Map<string, LegacyTripVehicleAllocation>;
}): number {
  if (isVehicleAllocEnforced() && input.enforcedByShipper) {
    return input.enforcedByShipper.get(input.shipperId)?.allocatedCostMyr ?? 0;
  }
  if (
    input.vehicleAllocationDenominator <= 0 ||
    input.tripAllocatedWithoutLoadUnload <= 0 ||
    input.quantity <= 0
  ) {
    return 0;
  }
  return roundMoney(
    (input.quantity / input.vehicleAllocationDenominator) *
      input.tripAllocatedWithoutLoadUnload
  );
}

export interface OperationsTripCostSlice {
  routeCosts: TripRouteCosts;
  fuelMyr: number;
  maintenanceMyr: number;
  fishCheckingFee: number;
  parkingFee: number;
  borderPass: number;
  loadUnloadFee: number;
  epermit: number;
  dagangNet: number;
  forwarding: number;
  tripMileageKm: number;
}

/** Operations dashboard trip-level variable costs (legacy or enforced). */
export function resolveOperationsTripCostSlice(
  input: ResolveTripAllocatedPoolInput & { otherOnly?: boolean }
): OperationsTripCostSlice {
  const resolved = resolveTripAllocatedPool(input);
  const { pool, routeCosts } = resolved;
  const otherOnly = input.otherOnly ?? false;

  return {
    routeCosts,
    fuelMyr: pool.fuelMyr,
    maintenanceMyr: pool.maintenanceMyr,
    fishCheckingFee: pool.fishCheckingMyr,
    parkingFee: pool.parkingMyr,
    borderPass: otherOnly ? 0 : pool.borderPassMyr,
    loadUnloadFee: otherOnly ? 0 : pool.loadUnloadMyr,
    epermit: otherOnly ? 0 : pool.epermitMyr,
    dagangNet: otherOnly ? 0 : pool.dagangNetMyr,
    forwarding: otherOnly ? 0 : pool.forwardingMyr,
    tripMileageKm: routeCosts.tripMileageKm,
  };
}
