/**
 * Leg-based vehicle route costs: sort route groups by sadoo mileage (near→far),
 * split incremental distance/toll legs, compute per-leg fuel/maintenance/toll pools.
 * Pure function — not wired to P&L/operations until Step 7.
 */
import { getRouteGroupForMarket } from "@/lib/payroll-route-label";
import {
  calcFuelCostPerKm,
  calcTotalCostPerKm,
} from "@/lib/truck-cost";
import {
  resolveRouteTollFee,
  type RouteMasterCostRow,
} from "@/lib/trip-route-cost";

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export interface RouteGroupCostPoint {
  routeGroup: string;
  sadooMileageKm: number;
  cumulativeTollMyr: number;
}

export interface VehicleLeg {
  legIndex: number;
  toRouteGroup: string;
  distanceKm: number;
  fuelMyr: number;
  maintenanceMyr: number;
  tollMyr: number;
  variableCostMyr: number;
}

export interface VehicleLegPlan {
  routeGroups: string[];
  points: RouteGroupCostPoint[];
  legs: VehicleLeg[];
  totalDistanceKm: number;
  totalFuelMyr: number;
  totalMaintenanceMyr: number;
  totalTollMyr: number;
  totalVariableCostMyr: number;
}

export interface BuildVehicleLegPlanInput {
  /** Route groups present on the trip (e.g. from getRouteGroups). */
  routeGroups: string[];
  routes: RouteMasterCostRow[];
  tollClass?: string | null;
  fuelPriceMyr: number;
  truck: {
    fuelEfficiencyKmPerL: number | null;
    annualMileageKm: number | null;
    costItems: { annualAmount: number }[];
  };
}

function resolveRouteGroupPoint(
  routeGroup: string,
  routes: RouteMasterCostRow[],
  tollClass?: string | null
): RouteGroupCostPoint | null {
  const byCode = routes.find((route) => route.code === routeGroup);
  const route = byCode ?? routes.find((r) => r.markets.includes(routeGroup));
  if (!route) return null;

  const mileage = route.sadooMileageKm ?? 0;
  if (mileage <= 0) return null;

  return {
    routeGroup,
    sadooMileageKm: mileage,
    cumulativeTollMyr: resolveRouteTollFee(route, tollClass),
  };
}

/** Sort trip route groups by sadoo mileage ascending (near → far). */
export function sortRouteGroupsByMileage(
  routeGroups: string[],
  routes: RouteMasterCostRow[],
  tollClass?: string | null
): RouteGroupCostPoint[] {
  const points: RouteGroupCostPoint[] = [];
  for (const group of routeGroups) {
    const point = resolveRouteGroupPoint(group, routes, tollClass);
    if (point) points.push(point);
  }
  points.sort((a, b) => a.sadooMileageKm - b.sadooMileageKm);
  return points;
}

/**
 * Incremental toll per leg: cumulative toll at destination minus previous leg end.
 * Matches legacy max cumulative toll when summed (§2.2 conservation).
 */
export function incrementalTollForLeg(
  currentToll: number,
  previousCumulativeToll: number
): number {
  const delta = currentToll - previousCumulativeToll;
  return delta > 0 ? roundMoney(delta) : 0;
}

export function buildVehicleLegPlan(
  input: BuildVehicleLegPlanInput
): VehicleLegPlan {
  const points = sortRouteGroupsByMileage(
    input.routeGroups,
    input.routes,
    input.tollClass
  );

  const fuelPerKm = calcFuelCostPerKm(
    input.fuelPriceMyr,
    input.truck.fuelEfficiencyKmPerL
  );
  const maintenancePerKm = calcTotalCostPerKm(
    input.truck.costItems,
    input.truck.annualMileageKm
  );

  if (points.length === 0) {
    return {
      routeGroups: [],
      points: [],
      legs: [],
      totalDistanceKm: 0,
      totalFuelMyr: 0,
      totalMaintenanceMyr: 0,
      totalTollMyr: 0,
      totalVariableCostMyr: 0,
    };
  }

  const legs: VehicleLeg[] = [];
  let previousMileage = 0;
  let previousToll = 0;

  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    const distanceKm = roundMoney(point.sadooMileageKm - previousMileage);
    const fuelMyr = roundMoney(
      fuelPerKm != null ? distanceKm * fuelPerKm : 0
    );
    const maintenanceMyr = roundMoney(
      maintenancePerKm != null ? distanceKm * maintenancePerKm : 0
    );
    const tollMyr = incrementalTollForLeg(
      point.cumulativeTollMyr,
      previousToll
    );
    const variableCostMyr = roundMoney(fuelMyr + maintenanceMyr);

    legs.push({
      legIndex: index,
      toRouteGroup: point.routeGroup,
      distanceKm,
      fuelMyr,
      maintenanceMyr,
      tollMyr,
      variableCostMyr,
    });

    previousMileage = point.sadooMileageKm;
    previousToll = point.cumulativeTollMyr;
  }

  const totalFuelMyr = roundMoney(legs.reduce((sum, leg) => sum + leg.fuelMyr, 0));
  const totalMaintenanceMyr = roundMoney(
    legs.reduce((sum, leg) => sum + leg.maintenanceMyr, 0)
  );
  const totalTollMyr = roundMoney(legs.reduce((sum, leg) => sum + leg.tollMyr, 0));
  const totalDistanceKm = roundMoney(
    legs.reduce((sum, leg) => sum + leg.distanceKm, 0)
  );

  return {
    routeGroups: points.map((point) => point.routeGroup),
    points,
    legs,
    totalDistanceKm,
    totalFuelMyr,
    totalMaintenanceMyr,
    totalTollMyr,
    totalVariableCostMyr: roundMoney(totalFuelMyr + totalMaintenanceMyr),
  };
}

/** Map inbound line market code → main route group (KL/BM/MC/…). */
export function routeGroupForLineMarket(marketCode: string): string {
  return getRouteGroupForMarket(marketCode);
}

/** Leg i is allocatable to lines whose destination group is at or beyond leg i. */
export function isLineEligibleForLeg(
  lineRouteGroup: string,
  legIndex: number,
  sortedRouteGroups: string[]
): boolean {
  const groupIndex = sortedRouteGroups.indexOf(lineRouteGroup);
  if (groupIndex < 0) return legIndex === 0;
  return groupIndex >= legIndex;
}
