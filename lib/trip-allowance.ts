import { sortMarkets } from "@/lib/markets";

export interface RouteAllowanceInput {
  code: string;
  markets: string[];
  driverAllowance: number | null;
  displayOrder: number | null;
}

export interface TripAllowanceResult {
  tripAllowance: number;
  primaryRouteCode: string | null;
  extraMarketCount: number;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateTripAllowance(input: {
  markets: string[];
  routes: RouteAllowanceInput[];
  extraMarketAllowance: number;
}): TripAllowanceResult {
  const dispatchMarkets = sortMarkets(
    Array.from(
      new Set(
        input.markets.map((code) => code.trim().toUpperCase()).filter(Boolean)
      )
    )
  );

  if (dispatchMarkets.length === 0) {
    return { tripAllowance: 0, primaryRouteCode: null, extraMarketCount: 0 };
  }

  const applicableRoutes = input.routes.filter((route) =>
    dispatchMarkets.some((market) => route.markets.includes(market))
  );

  if (applicableRoutes.length === 0) {
    return {
      tripAllowance: roundMoney(
        dispatchMarkets.length * input.extraMarketAllowance
      ),
      primaryRouteCode: null,
      extraMarketCount: dispatchMarkets.length,
    };
  }

  const winningRoute = applicableRoutes.reduce((best, route) => {
    const allowance = route.driverAllowance ?? 0;
    const bestAllowance = best.driverAllowance ?? 0;
    if (allowance > bestAllowance) return route;
    if (allowance < bestAllowance) return best;
    const routeOrder = route.displayOrder ?? 999;
    const bestOrder = best.displayOrder ?? 999;
    return routeOrder < bestOrder ? route : best;
  });

  const winningMarketSet = new Set(winningRoute.markets);
  const extraMarkets = dispatchMarkets.filter(
    (market) => !winningMarketSet.has(market)
  );

  return {
    tripAllowance: roundMoney(
      (winningRoute.driverAllowance ?? 0) +
        extraMarkets.length * input.extraMarketAllowance
    ),
    primaryRouteCode: winningRoute.code,
    extraMarketCount: extraMarkets.length,
  };
}

export function crateCommissionForTruckType(
  truckType: string | null | undefined,
  rates: {
    bigTruckCrateCommission: number | null;
    smallTruckCrateCommission: number | null;
  }
) {
  if (truckType === "small") return rates.smallTruckCrateCommission ?? 0;
  return rates.bigTruckCrateCommission ?? 0;
}

export function getDriverPayrollName(driver: {
  fullName: string | null;
  name: string;
}) {
  const fullName = driver.fullName?.trim();
  return fullName || driver.name;
}
