import { sortMarkets } from "@/lib/markets";
import { toDateInputValue } from "@/lib/date-utils";
import { getRouteGroupForMarket, getRouteGroups, getRouteLabel } from "@/lib/payroll-route-label";

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

export interface TripAllowanceDebug {
  markets: string[];
  routeGroups: string[];
  groupCount: number;
  primaryRouteCode: string | null;
  primaryRouteAllowance: number;
  extraMarketCount: number;
  extraMarketAllowancePer: number;
  extraMarketTotal: number;
  tripAllowanceTotal: number;
  formula: string;
  crateReturn: {
    triggered: boolean;
    truckType: string | null;
    rate: number;
    commission: number;
    formula: string;
  };
}

export function explainTripAllowance(input: {
  markets: string[];
  routes: RouteAllowanceInput[];
  extraMarketAllowance: number;
  truckType?: string | null;
  hasCrateReturn?: boolean;
  crateRates?: {
    bigTruckCrateCommission: number | null;
    smallTruckCrateCommission: number | null;
  };
}): TripAllowanceDebug {
  const allowance = calculateTripAllowance({
    markets: input.markets,
    routes: input.routes,
    extraMarketAllowance: input.extraMarketAllowance,
  });
  const dispatchMarkets = normalizeDispatchMarkets(input.markets);
  const routeGroups = getRouteGroups(dispatchMarkets);
  const groupCount = countPayrollMarketGroups(dispatchMarkets, input.routes);
  const primaryRouteAllowance =
    allowance.tripAllowance -
    allowance.extraMarketCount * input.extraMarketAllowance;
  const extraMarketTotal = roundMoney(
    allowance.extraMarketCount * input.extraMarketAllowance
  );
  const crateRates = input.crateRates ?? {
    bigTruckCrateCommission: null,
    smallTruckCrateCommission: null,
  };
  const crateCommission = crateReturnCommissionForDispatch({
    truckType: input.truckType,
    hasCrateReturn: input.hasCrateReturn ?? false,
    rates: crateRates,
  });
  const crateRate = input.hasCrateReturn
    ? crateCommissionForTruckType(input.truckType, crateRates)
    : 0;

  const formula =
    allowance.primaryRouteCode == null
      ? `${groupCount} 组 × RM${input.extraMarketAllowance} = RM${allowance.tripAllowance}`
      : `最高路线 ${allowance.primaryRouteCode} RM${primaryRouteAllowance}` +
        (allowance.extraMarketCount > 0
          ? ` + 额外 ${allowance.extraMarketCount} 组 × RM${input.extraMarketAllowance} = RM${extraMarketTotal}`
          : "") +
        ` → 趟次津贴 RM${allowance.tripAllowance}`;

  const crateFormula = input.hasCrateReturn
    ? `${input.truckType === "small" ? "小车" : "大车"} RM${crateRate}/趟（有回桶）`
    : "无回桶记录，提成 RM0";

  return {
    markets: dispatchMarkets,
    routeGroups,
    groupCount,
    primaryRouteCode: allowance.primaryRouteCode,
    primaryRouteAllowance: roundMoney(Math.max(0, primaryRouteAllowance)),
    extraMarketCount: allowance.extraMarketCount,
    extraMarketAllowancePer: input.extraMarketAllowance,
    extraMarketTotal,
    tripAllowanceTotal: allowance.tripAllowance,
    formula,
    crateReturn: {
      triggered: Boolean(input.hasCrateReturn),
      truckType: input.truckType ?? null,
      rate: crateRate,
      commission: crateCommission,
      formula: crateFormula,
    },
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

export interface CrateReturnCommissionRates {
  bigTruckCrateCommission: number | null;
  smallTruckCrateCommission: number | null;
  bpCrateCommissionBigTruck: number | null;
  bpCrateCommissionSmallTruck: number | null;
}

export interface CrateReturnPlateDayInfo {
  hasReturn: boolean;
  hasBpReturn: boolean;
  /** Distinct primary route groups with qty>0 (BM/P/TP/KT/NT/SA = one BM group). */
  returnMarketGroupCount: number;
}

/** One physical return (date+plate) earns at most one commission, assigned to one payroll trip. */
export type CrateReturnCommissionTripRef =
  | { source: "dispatch"; dispatchOrderId: string }
  | { source: "charter"; charterTripId: string };

function normalizePlate(plate: string) {
  return plate.trim().toUpperCase();
}

function crateReturnPlateDayKey(date: Date | string, plate: string) {
  const dateKey =
    typeof date === "string" ? date.slice(0, 10) : toDateInputValue(date);
  return `${dateKey}|${normalizePlate(plate)}`;
}

export function buildCrateReturnImportContext(
  imports: {
    date: Date | string;
    quantity: number;
    truck: { plate: string };
    market: { code: string };
  }[]
) {
  const context = new Map<string, CrateReturnPlateDayInfo>();
  const groupsByPlateDay = new Map<string, Set<string>>();

  for (const row of imports) {
    if (row.quantity <= 0) continue;
    const key = crateReturnPlateDayKey(row.date, row.truck.plate);
    const existing = context.get(key) ?? {
      hasReturn: false,
      hasBpReturn: false,
      returnMarketGroupCount: 0,
    };
    existing.hasReturn = true;
    if (row.market.code.trim().toUpperCase() === "BP") {
      existing.hasBpReturn = true;
    }

    const groups = groupsByPlateDay.get(key) ?? new Set<string>();
    groups.add(getRouteGroupForMarket(row.market.code));
    groupsByPlateDay.set(key, groups);

    existing.returnMarketGroupCount = groups.size;
    context.set(key, existing);
  }
  return context;
}

export function getCrateReturnPlateDayInfo(
  context: Map<string, CrateReturnPlateDayInfo>,
  date: Date,
  plate: string
): CrateReturnPlateDayInfo | undefined {
  return context.get(crateReturnPlateDayKey(date, plate));
}

export function crateReturnCommissionAmount(input: {
  truckType: string | null | undefined;
  plateDay: CrateReturnPlateDayInfo | undefined;
  rates: CrateReturnCommissionRates;
}) {
  if (!input.plateDay?.hasReturn) return 0;
  const tier = input.plateDay.hasBpReturn
    ? {
        bigTruckCrateCommission: input.rates.bpCrateCommissionBigTruck,
        smallTruckCrateCommission: input.rates.bpCrateCommissionSmallTruck,
      }
    : {
        bigTruckCrateCommission: input.rates.bigTruckCrateCommission,
        smallTruckCrateCommission: input.rates.smallTruckCrateCommission,
      };
  return crateCommissionForTruckType(input.truckType, tier);
}

export function crateReturnCommissionForTrip(input: {
  truckType: string | null | undefined;
  isCommissionRecipient: boolean;
  plateDay: CrateReturnPlateDayInfo | undefined;
  rates: CrateReturnCommissionRates;
}) {
  if (!input.isCommissionRecipient) return 0;
  return crateReturnCommissionAmount({
    truckType: input.truckType,
    plateDay: input.plateDay,
    rates: input.rates,
  });
}

/** Flat bonus when same truck+day returns crates from 2+ distinct primary markets (qty>0). */
export function crateReturnMultiMarketAllowanceAmount(input: {
  plateDay: CrateReturnPlateDayInfo | undefined;
  allowanceRate: number;
}) {
  if (!input.plateDay?.hasReturn) return 0;
  if (input.plateDay.returnMarketGroupCount < 2) return 0;
  return input.allowanceRate;
}

export function crateReturnMultiMarketAllowanceForTrip(input: {
  isCommissionRecipient: boolean;
  plateDay: CrateReturnPlateDayInfo | undefined;
  allowanceRate: number;
}) {
  if (!input.isCommissionRecipient) return 0;
  return crateReturnMultiMarketAllowanceAmount({
    plateDay: input.plateDay,
    allowanceRate: input.allowanceRate,
  });
}

/** @deprecated Use buildCrateReturnImportContext */
export function buildCrateReturnImportLookup(
  imports: {
    date: Date | string;
    quantity: number;
    truck: { plate: string };
  }[]
) {
  const lookup = new Set<string>();
  for (const row of imports) {
    if (row.quantity <= 0) continue;
    lookup.add(crateReturnPlateDayKey(row.date, row.truck.plate));
  }
  return lookup;
}

/** @deprecated Use getCrateReturnPlateDayInfo */
export function dispatchHasCrateReturn(
  order: {
    date: Date;
    truck: { plate: string };
  },
  importLookup: Set<string>
) {
  return importLookup.has(crateReturnPlateDayKey(order.date, order.truck.plate));
}

/** @deprecated Use crateReturnCommissionForTrip */
export function crateReturnCommissionForDispatch(input: {
  truckType: string | null | undefined;
  hasCrateReturn: boolean;
  rates: Pick<
    CrateReturnCommissionRates,
    "bigTruckCrateCommission" | "smallTruckCrateCommission"
  >;
}) {
  if (!input.hasCrateReturn) return 0;
  return crateCommissionForTruckType(input.truckType, input.rates);
}

/** @deprecated Use crateReturnCommissionForTrip */
export function crateReturnCommissionForCharter(input: {
  truckType: string | null | undefined;
  hasCrateReturn: boolean;
  hasDispatchOnSameDateTruck: boolean;
  rates: Pick<
    CrateReturnCommissionRates,
    "bigTruckCrateCommission" | "smallTruckCrateCommission"
  >;
}) {
  if (!input.hasCrateReturn || input.hasDispatchOnSameDateTruck) return 0;
  return crateCommissionForTruckType(input.truckType, input.rates);
}

export function getDriverPayrollName(driver: {
  fullName: string | null;
  name: string;
}) {
  const fullName = driver.fullName?.trim();
  return fullName || driver.name;
}
