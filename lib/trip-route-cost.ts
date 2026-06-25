import {
  calcFuelCostPerKm,
  calcTotalCostPerKm,
} from "@/lib/truck-cost";
import { normalizeTripMarkets } from "@/lib/trip-allowance";

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function maxFee(values: (number | null | undefined)[]) {
  if (values.length === 0) return 0;
  return Math.max(...values.map((value) => value ?? 0));
}

function sumFees(values: (number | null | undefined)[]): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

export interface RouteMasterCostRow {
  code: string;
  markets: string[];
  sadooMileageKm: number | null;
  tollFee: number | null;
  tollFeeClass2: number | null;
  tollFeeClass3: number | null;
  fishCheckingFee: number | null;
  parkingFee: number | null;
}

export interface TripRouteCosts {
  tripMileageKm: number;
  tollFee: number;
  fishCheckingFee: number;
  parkingFee: number;
  borderPass: number;
  epermit: number;
  dagangNet: number;
  forwarding: number;
}

export interface TripTruckCosts {
  fuelMyr: number;
  maintenanceMyr: number;
}

export function resolveRouteTollFee(
  route: Pick<RouteMasterCostRow, "tollFee" | "tollFeeClass2" | "tollFeeClass3">,
  tollClass?: string | null
) {
  if (tollClass === "class2") {
    return route.tollFeeClass2 ?? route.tollFeeClass3 ?? route.tollFee ?? 0;
  }
  return route.tollFeeClass3 ?? route.tollFee ?? 0;
}

/** Routes whose market list intersects the dispatch markets (one row per route master). */
export function findApplicableRoutes(
  dispatchMarkets: string[],
  routes: RouteMasterCostRow[]
): RouteMasterCostRow[] {
  const markets = normalizeTripMarkets(dispatchMarkets);
  if (markets.length === 0) return [];

  return routes.filter((route) =>
    markets.some((market) => route.markets.includes(market))
  );
}

export function computeTripRouteCosts(
  applicableRoutes: RouteMasterCostRow[],
  globalCosts: {
    borderPass: number;
    epermit: number;
    dagangNet: number;
    forwardingOutbound: number;
  },
  tollClass?: string | null
): TripRouteCosts {
  return {
    tripMileageKm: maxFee(applicableRoutes.map((route) => route.sadooMileageKm)),
    tollFee: maxFee(
      applicableRoutes.map((route) => resolveRouteTollFee(route, tollClass))
    ),
    fishCheckingFee: sumFees(
      applicableRoutes.map((route) => route.fishCheckingFee)
    ),
    parkingFee: sumFees(applicableRoutes.map((route) => route.parkingFee)),
    borderPass: globalCosts.borderPass,
    epermit: globalCosts.epermit,
    dagangNet: globalCosts.dagangNet,
    forwarding: globalCosts.forwardingOutbound,
  };
}

export function computeTripTruckCosts(
  tripMileageKm: number,
  truck: {
    fuelEfficiencyKmPerL: number | null;
    annualMileageKm: number | null;
    costItems: { annualAmount: number }[];
  },
  fuelPriceMyr: number
): TripTruckCosts {
  if (tripMileageKm <= 0) {
    return { fuelMyr: 0, maintenanceMyr: 0 };
  }

  const fuelPerKm = calcFuelCostPerKm(
    fuelPriceMyr,
    truck.fuelEfficiencyKmPerL
  );
  const fixedPerKm = calcTotalCostPerKm(
    truck.costItems,
    truck.annualMileageKm
  );

  return {
    fuelMyr: roundMoney(
      fuelPerKm != null ? tripMileageKm * fuelPerKm : 0
    ),
    maintenanceMyr: roundMoney(
      fixedPerKm != null ? tripMileageKm * fixedPerKm : 0
    ),
  };
}
