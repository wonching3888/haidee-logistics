/**
 * Line-level vehicle + global trip cost allocation (Step 4).
 * Global fees by vehicle-allocatable barrels; fuel/maintenance/toll by leg eligibility.
 */
import type { LineAllocation, TripCostLineInput } from "@/lib/trip-cost-engine/types";
import {
  isLineEligibleForLeg,
  routeGroupForLineMarket,
  type VehicleLeg,
  type VehicleLegPlan,
} from "@/lib/trip-cost-engine/vehicle-leg-resolver";

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function allocateShare(part: number, total: number, amount: number): number {
  if (total <= 0 || amount <= 0 || part <= 0) return 0;
  return roundMoney((part / total) * amount);
}

export interface TripGlobalFeePool {
  borderPassMyr: number;
  fishCheckingMyr: number;
  epermitMyr: number;
  dagangNetMyr: number;
  forwardingMyr: number;
  driverMyr: number;
}

export interface AllocateTripLineCostsInput {
  lines: TripCostLineInput[];
  legPlan: VehicleLegPlan;
  globalFees: TripGlobalFeePool;
}

export interface TripLineCostAllocationResult {
  allocations: LineAllocation[];
  totals: {
    fuelMyr: number;
    maintenanceMyr: number;
    tollMyr: number;
    borderPassMyr: number;
    fishCheckingMyr: number;
    epermitMyr: number;
    dagangNetMyr: number;
    forwardingMyr: number;
    driverMyr: number;
    totalVehicleLegMyr: number;
    totalGlobalMyr: number;
    totalAllocatedMyr: number;
  };
}

function vehicleQuantity(line: TripCostLineInput): number {
  if (line.excludeFromVehicleAllocation) return 0;
  if (line.quantity <= 0) return 0;
  return line.quantity;
}

function allocateLegComponent(
  leg: VehicleLeg,
  lines: TripCostLineInput[],
  sortedRouteGroups: string[],
  component: "fuelMyr" | "maintenanceMyr" | "tollMyr"
): Map<string, number> {
  const amount = leg[component];
  const shares = new Map<string, number>();
  if (amount <= 0) return shares;

  const eligible = lines.filter((line) => {
    const qty = vehicleQuantity(line);
    if (qty <= 0) return false;
    const group = routeGroupForLineMarket(line.marketCode);
    return isLineEligibleForLeg(group, leg.legIndex, sortedRouteGroups);
  });

  const denominator = eligible.reduce((sum, line) => sum + vehicleQuantity(line), 0);
  if (denominator <= 0) return shares;

  let allocated = 0;
  for (let index = 0; index < eligible.length; index++) {
    const line = eligible[index];
    const qty = vehicleQuantity(line);
    let share: number;
    if (index === eligible.length - 1) {
      share = roundMoney(amount - allocated);
    } else {
      share = allocateShare(qty, denominator, amount);
      allocated += share;
    }
    shares.set(line.lineId, (shares.get(line.lineId) ?? 0) + share);
  }

  return shares;
}

function allocateGlobalComponent(
  lines: TripCostLineInput[],
  amount: number
): Map<string, number> {
  const shares = new Map<string, number>();
  if (amount <= 0) return shares;

  const eligible = lines.filter((line) => vehicleQuantity(line) > 0);
  const denominator = eligible.reduce((sum, line) => sum + vehicleQuantity(line), 0);
  if (denominator <= 0) return shares;

  let allocated = 0;
  for (let index = 0; index < eligible.length; index++) {
    const line = eligible[index];
    const qty = vehicleQuantity(line);
    let share: number;
    if (index === eligible.length - 1) {
      share = roundMoney(amount - allocated);
    } else {
      share = allocateShare(qty, denominator, amount);
      allocated += share;
    }
    shares.set(line.lineId, share);
  }

  return shares;
}

export function allocateTripLineCosts(
  input: AllocateTripLineCostsInput
): TripLineCostAllocationResult {
  const { lines, legPlan, globalFees } = input;
  const sortedGroups = legPlan.routeGroups;

  const fuelByLine = new Map<string, number>();
  const maintenanceByLine = new Map<string, number>();
  const tollByLine = new Map<string, number>();

  for (const leg of legPlan.legs) {
    allocateLegComponent(leg, lines, sortedGroups, "fuelMyr").forEach(
      (share, lineId) => {
        fuelByLine.set(lineId, (fuelByLine.get(lineId) ?? 0) + share);
      }
    );
    allocateLegComponent(leg, lines, sortedGroups, "maintenanceMyr").forEach(
      (share, lineId) => {
        maintenanceByLine.set(
          lineId,
          (maintenanceByLine.get(lineId) ?? 0) + share
        );
      }
    );
    allocateLegComponent(leg, lines, sortedGroups, "tollMyr").forEach(
      (share, lineId) => {
        tollByLine.set(lineId, (tollByLine.get(lineId) ?? 0) + share);
      }
    );
  }

  const borderByLine = allocateGlobalComponent(lines, globalFees.borderPassMyr);
  const fishByLine = allocateGlobalComponent(lines, globalFees.fishCheckingMyr);
  const epermitByLine = allocateGlobalComponent(lines, globalFees.epermitMyr);
  const dagangByLine = allocateGlobalComponent(lines, globalFees.dagangNetMyr);
  const forwardingByLine = allocateGlobalComponent(
    lines,
    globalFees.forwardingMyr
  );
  const driverByLine = allocateGlobalComponent(lines, globalFees.driverMyr);

  const allocations: LineAllocation[] = lines.map((line) => {
    const fuelMyr = fuelByLine.get(line.lineId) ?? 0;
    const maintenanceMyr = maintenanceByLine.get(line.lineId) ?? 0;
    const tollMyr = tollByLine.get(line.lineId) ?? 0;
    const borderPassMyr = borderByLine.get(line.lineId) ?? 0;
    const fishCheckingMyr = fishByLine.get(line.lineId) ?? 0;
    const epermitMyr = epermitByLine.get(line.lineId) ?? 0;
    const dagangNetMyr = dagangByLine.get(line.lineId) ?? 0;
    const forwardingMyr = forwardingByLine.get(line.lineId) ?? 0;
    const driverMyr = driverByLine.get(line.lineId) ?? 0;

    const totalAllocatedMyr = roundMoney(
      fuelMyr +
        maintenanceMyr +
        tollMyr +
        borderPassMyr +
        fishCheckingMyr +
        epermitMyr +
        dagangNetMyr +
        forwardingMyr +
        driverMyr
    );

    return {
      lineId: line.lineId,
      shipperId: line.shipperId,
      marketCode: line.marketCode,
      quantity: line.quantity,
      fuelMyr,
      maintenanceMyr,
      tollMyr,
      borderPassMyr,
      fishCheckingMyr,
      parkingMyr: 0,
      epermitMyr,
      dagangNetMyr,
      forwardingMyr,
      driverMyr,
      unloadFeeMyr: 0,
      totalAllocatedMyr,
    };
  });

  const sumField = (field: keyof LineAllocation) =>
    roundMoney(allocations.reduce((sum, row) => sum + (row[field] as number), 0));

  const totalVehicleLegMyr = roundMoney(
    sumField("fuelMyr") + sumField("maintenanceMyr") + sumField("tollMyr")
  );
  const totalGlobalMyr = roundMoney(
    sumField("borderPassMyr") +
      sumField("fishCheckingMyr") +
      sumField("epermitMyr") +
      sumField("dagangNetMyr") +
      sumField("forwardingMyr") +
      sumField("driverMyr")
  );

  return {
    allocations,
    totals: {
      fuelMyr: sumField("fuelMyr"),
      maintenanceMyr: sumField("maintenanceMyr"),
      tollMyr: sumField("tollMyr"),
      borderPassMyr: sumField("borderPassMyr"),
      fishCheckingMyr: sumField("fishCheckingMyr"),
      epermitMyr: sumField("epermitMyr"),
      dagangNetMyr: sumField("dagangNetMyr"),
      forwardingMyr: sumField("forwardingMyr"),
      driverMyr: sumField("driverMyr"),
      totalVehicleLegMyr,
      totalGlobalMyr,
      totalAllocatedMyr: roundMoney(totalVehicleLegMyr + totalGlobalMyr),
    },
  };
}

export function assertTripVehicleAllocationConserved(
  result: TripLineCostAllocationResult,
  expectedPool: {
    fuelMyr: number;
    maintenanceMyr: number;
    tollMyr: number;
    borderPassMyr: number;
    fishCheckingMyr: number;
    epermitMyr: number;
    dagangNetMyr: number;
    forwardingMyr: number;
    driverMyr: number;
  },
  tolerance = 0.01
): void {
  const checks: Array<[string, number, number]> = [
    ["fuelMyr", result.totals.fuelMyr, expectedPool.fuelMyr],
    ["maintenanceMyr", result.totals.maintenanceMyr, expectedPool.maintenanceMyr],
    ["tollMyr", result.totals.tollMyr, expectedPool.tollMyr],
    ["borderPassMyr", result.totals.borderPassMyr, expectedPool.borderPassMyr],
    ["fishCheckingMyr", result.totals.fishCheckingMyr, expectedPool.fishCheckingMyr],
    ["epermitMyr", result.totals.epermitMyr, expectedPool.epermitMyr],
    ["dagangNetMyr", result.totals.dagangNetMyr, expectedPool.dagangNetMyr],
    ["forwardingMyr", result.totals.forwardingMyr, expectedPool.forwardingMyr],
    ["driverMyr", result.totals.driverMyr, expectedPool.driverMyr],
  ];

  for (const [label, actual, expected] of checks) {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(
        `Conservation failed for ${label}: allocated ${actual} vs pool ${expected}`
      );
    }
  }
}

/** Sum allocations for a route group (for shipper/market assertions). */
export function sumAllocationsByRouteGroup(
  allocations: LineAllocation[],
  routeGroup: string
): number {
  return roundMoney(
    allocations
      .filter((row) => routeGroupForLineMarket(row.marketCode) === routeGroup)
      .reduce((sum, row) => sum + row.totalAllocatedMyr, 0)
  );
}

/** Variable leg costs only (fuel + maintenance + toll), excluding global fees. */
export function sumVariableLegAllocationsByRouteGroup(
  allocations: LineAllocation[],
  routeGroup: string
): number {
  return roundMoney(
    allocations
      .filter((row) => routeGroupForLineMarket(row.marketCode) === routeGroup)
      .reduce(
        (sum, row) => sum + row.fuelMyr + row.maintenanceMyr + row.tollMyr,
        0
      )
  );
}
