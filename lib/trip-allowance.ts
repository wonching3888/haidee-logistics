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

function normalizeDispatchMarkets(markets: string[]) {
  return sortMarkets(
    Array.from(
      new Set(
        markets.map((code) => code.trim().toUpperCase()).filter(Boolean)
      )
    )
  );
}

/** Map a market code to its payroll route group (most specific route wins). */
export function findRouteForMarket(
  market: string,
  routes: RouteAllowanceInput[]
): RouteAllowanceInput | null {
  const matches = routes.filter((route) => route.markets.includes(market));
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  return [...matches].sort((a, b) => a.markets.length - b.markets.length)[0];
}

function payrollGroupKey(market: string, routes: RouteAllowanceInput[]) {
  const route = findRouteForMarket(market, routes);
  return route?.code ?? `__${market}`;
}

/** Count distinct route groups on a trip (BM/P/TP/KT = 1 group). */
export function countPayrollMarketGroups(
  markets: string[],
  routes: RouteAllowanceInput[]
) {
  const dispatchMarkets = normalizeDispatchMarkets(markets);
  if (dispatchMarkets.length === 0) return 0;

  const groups = new Set<string>();
  for (const market of dispatchMarkets) {
    groups.add(payrollGroupKey(market, routes));
  }
  return groups.size;
}

export function calculateTripAllowance(input: {
  markets: string[];
  routes: RouteAllowanceInput[];
  extraMarketAllowance: number;
}): TripAllowanceResult {
  const dispatchMarkets = normalizeDispatchMarkets(input.markets);

  if (dispatchMarkets.length === 0) {
    return { tripAllowance: 0, primaryRouteCode: null, extraMarketCount: 0 };
  }

  const applicableRoutes = input.routes.filter((route) =>
    dispatchMarkets.some((market) => route.markets.includes(market))
  );

  const groupCount = countPayrollMarketGroups(dispatchMarkets, input.routes);

  if (applicableRoutes.length === 0) {
    return {
      tripAllowance: roundMoney(groupCount * input.extraMarketAllowance),
      primaryRouteCode: null,
      extraMarketCount: Math.max(0, groupCount - 1),
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

  const extraGroupCount = Math.max(0, groupCount - 1);

  return {
    tripAllowance: roundMoney(
      (winningRoute.driverAllowance ?? 0) +
        extraGroupCount * input.extraMarketAllowance
    ),
    primaryRouteCode: winningRoute.code,
    extraMarketCount: extraGroupCount,
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
