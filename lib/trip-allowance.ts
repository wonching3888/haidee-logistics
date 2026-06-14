import { sortMarkets } from "@/lib/markets";
import { toDateInputValue } from "@/lib/date-utils";
import { getRouteGroups, getRouteLabel } from "@/lib/payroll-route-label";

export { getRouteGroups, getRouteLabel } from "@/lib/payroll-route-label";

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

/** Normalize trip markets from array or delimited string. */
export function normalizeTripMarkets(markets: string[] | string): string[] {
  const raw =
    typeof markets === "string"
      ? markets.split(/[,/]/).map((part) => part.trim())
      : markets;
  return normalizeDispatchMarkets(raw);
}

export function formatTripRouteLabel(
  markets: string[] | string | null | undefined
): string {
  return getRouteLabel(markets);
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
  const mapped = getRouteGroups([market])[0];
  if (mapped) return mapped;
  const route = findRouteForMarket(market, routes);
  return route?.code ?? `__${market}`;
}

/** Count distinct route groups on a trip (BM/P/TP/KT = 1 group). */
export function countPayrollMarketGroups(
  markets: string[],
  routes: RouteAllowanceInput[]
) {
  const grouped = getRouteGroups(markets);
  if (grouped.length > 0) return grouped.length;

  const dispatchMarkets = normalizeDispatchMarkets(markets);
  if (dispatchMarkets.length === 0) return 0;

  const groups = new Set<string>();
  for (const market of dispatchMarkets) {
    groups.add(payrollGroupKey(market, routes));
  }
  return groups.size;
}

/** Distinct payroll route group labels for display (e.g. A / BM / KD). */
export function formatPayrollRouteGroups(
  markets: string[] | string
): string {
  return formatTripRouteLabel(markets);
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

  const allowanceRoutes = applicableRoutes.filter((route) => route.code !== "OTHER");
  const routesForPrimary =
    allowanceRoutes.length > 0 ? allowanceRoutes : applicableRoutes;

  const winningRoute = routesForPrimary.reduce((best, route) => {
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

export function crateReturnCommissionForDispatch(input: {
  truckType: string | null | undefined;
  hasCrateReturn: boolean;
  rates: {
    bigTruckCrateCommission: number | null;
    smallTruckCrateCommission: number | null;
  };
}) {
  if (!input.hasCrateReturn) return 0;
  return crateCommissionForTruckType(input.truckType, input.rates);
}

function normalizePlate(plate: string) {
  return plate.trim().toUpperCase();
}

/** Plates linked to a dispatch (Thai session plates, then MY truck plate fallback). */
export function collectDispatchReturnPlates(order: {
  truck: { plate: string };
  lines?: { inboundLine: { session: { thVehiclePlate: string | null } } }[];
}) {
  const plates = new Set<string>();
  for (const line of order.lines ?? []) {
    const thPlate = line.inboundLine.session.thVehiclePlate?.trim();
    if (thPlate) plates.add(normalizePlate(thPlate));
  }
  if (plates.size === 0 && order.truck.plate.trim()) {
    plates.add(normalizePlate(order.truck.plate));
  }
  return Array.from(plates);
}

export function buildCrateReturnExportLookup(
  exports: { date: Date | string; thVehiclePlate: string }[]
) {
  const lookup = new Set<string>();
  for (const row of exports) {
    const dateKey =
      typeof row.date === "string"
        ? row.date.slice(0, 10)
        : toDateInputValue(row.date);
    lookup.add(`${dateKey}|${normalizePlate(row.thVehiclePlate)}`);
  }
  return lookup;
}

export function dispatchHasCrateReturn(
  order: {
    date: Date;
    truck: { plate: string };
    lines?: { inboundLine: { session: { thVehiclePlate: string | null } } }[];
  },
  exportLookup: Set<string>
) {
  const dateKey = toDateInputValue(order.date);
  const plates = collectDispatchReturnPlates(order);
  return plates.some((plate) => exportLookup.has(`${dateKey}|${plate}`));
}

export function getDriverPayrollName(driver: {
  fullName: string | null;
  name: string;
}) {
  const fullName = driver.fullName?.trim();
  return fullName || driver.name;
}
