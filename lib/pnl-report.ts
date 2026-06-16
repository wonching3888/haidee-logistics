import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import { unloadRateKey } from "@/lib/constants/unload-rates";
import { listCrateRentalRates } from "@/lib/crate-rental-rates-service";
import { listGlobalCostSettings } from "@/lib/global-cost-settings-service";
import { loadInboundFreightContext } from "@/lib/freight-context";
import { convertThbToMyr, decimalToNumber } from "@/lib/freight-rates";
import { isOtherMarket } from "@/lib/markets";
import {
  computeInboundLineFreight,
  freightAmountMyrEquivalent,
  normalizeMcDeliveryMode,
  type InboundLineFreightSnapshot,
} from "@/lib/inbound-freight";
import {
  buildRouteKey,
  computeTripRouteCosts,
  computeTripTruckCosts,
  findApplicableRoutes,
  loadGlobalTripCostValues,
  type RouteMasterCostRow,
} from "@/lib/operations-cost";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { getRouteLabel, getRouteGroups } from "@/lib/payroll-route-label";
import {
  calendarDateUTC,
  getMonthDateRange,
  getYearDateRange,
} from "@/lib/reports/period-report-shared";
import { lookupUnloadRateMap } from "@/lib/unload-rates-service";
import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/date-utils";
import type {
  PnlCustomerData,
  PnlCustomerRow,
  PnlCustomerSort,
  PnlCustomerStatus,
  PnlCustomerSuggestion,
  PnlDailyTrendPoint,
  PnlPeriodData,
  PnlPeriodMode,
  PnlPeriodSummary,
  PnlReportData,
  PnlRouteFilter,
  PnlShipperRow,
  PnlTripListItem,
  PnlTripRow,
  PnlTripTotals,
  PnlTripsListData,
} from "@/lib/pnl-report-types";

export type {
  PnlCustomerData,
  PnlCustomerRow,
  PnlCustomerSort,
  PnlCustomerStatus,
  PnlCustomerSuggestion,
  PnlDailyTrendPoint,
  PnlPeriodData,
  PnlPeriodMode,
  PnlPeriodSummary,
  PnlReportData,
  PnlRouteFilter,
  PnlShipperRow,
  PnlTripListItem,
  PnlTripRow,
  PnlTripTotals,
  PnlTripsListData,
} from "@/lib/pnl-report-types";
export { PNL_ROUTE_FILTERS } from "@/lib/pnl-report-types";

const DEFAULT_LKIM_RATE = 2.5;

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function allocateShare(part: number, total: number, amount: number) {
  if (total <= 0 || amount <= 0 || part <= 0) return 0;
  return roundMoney((part / total) * amount);
}

function lineRevenueMyr(
  snapshot: InboundLineFreightSnapshot,
  exchangeRate: number
): number {
  if (snapshot.freightAmount == null || snapshot.freightAmount <= 0) {
    return 0;
  }

  let total = 0;
  if (snapshot.paymentMode === "1a" && snapshot.currency === "THB") {
    total += convertThbToMyr(snapshot.freightAmount, exchangeRate);
  } else if (snapshot.currency === "MYR") {
    total += snapshot.freightAmount;
  } else {
    const eq = freightAmountMyrEquivalent(snapshot);
    if (eq != null) total += eq;
  }

  if ((snapshot.dualPaymentWtlAmount ?? 0) > 0) {
    total += snapshot.dualPaymentWtlAmount!;
  }
  return roundMoney(total);
}

type FreightCtxCache = Awaited<
  ReturnType<typeof loadInboundFreightContext>
>["ctx"];

function freightCtxCacheKey(
  shipperId: string,
  pickup: ReturnType<typeof resolveSessionPickupLocation>,
  asOfDate: Date
) {
  return `${shipperId}|${pickup}|${toDateInputValue(asOfDate)}`;
}

async function ensureFreightCtx(
  cache: Map<string, FreightCtxCache>,
  stallIdsByKey: Map<string, Set<string>>,
  tongTypeIdsByKey: Map<string, Set<string>>,
  shipperId: string,
  stallIds: string[],
  tongTypeIds: string[],
  pickup: ReturnType<typeof resolveSessionPickupLocation>,
  asOfDate: Date
): Promise<FreightCtxCache> {
  const key = freightCtxCacheKey(shipperId, pickup, asOfDate);
  const stalls = stallIdsByKey.get(key) ?? new Set<string>();
  const tongTypes = tongTypeIdsByKey.get(key) ?? new Set<string>();
  let needsReload = !cache.has(key);

  for (const id of stallIds) {
    if (!stalls.has(id)) {
      stalls.add(id);
      needsReload = true;
    }
  }
  for (const id of tongTypeIds) {
    if (!tongTypes.has(id)) {
      tongTypes.add(id);
      needsReload = true;
    }
  }

  stallIdsByKey.set(key, stalls);
  tongTypeIdsByKey.set(key, tongTypes);

  if (needsReload) {
    const { ctx } = await loadInboundFreightContext(
      shipperId,
      Array.from(stalls),
      Array.from(tongTypes),
      asOfDate,
      pickup
    );
    cache.set(key, ctx);
  }

  return cache.get(key)!;
}

function customerStatus(marginPct: number, profit: number): PnlCustomerStatus {
  if (profit < 0) return "loss";
  if (marginPct > 30) return "excellent";
  if (marginPct >= 10) return "normal";
  return "caution";
}

function tripMatchesRouteFilter(
  routeGroups: string[],
  filter: PnlRouteFilter
): boolean {
  if (filter === "ALL") return true;
  return routeGroups.includes(filter);
}

function tripMatchesDriverFilter(
  driverName: string | null,
  filter: string
): boolean {
  if (filter === "ALL") return true;
  return (driverName ?? "").trim() === filter;
}

function resolveDateRange(input: {
  mode: PnlPeriodMode;
  year: number;
  month: number;
  day?: string;
  rangeStart?: string;
  rangeEnd?: string;
}) {
  if (input.mode === "year") return getYearDateRange(input.year);
  if (input.mode === "month") return getMonthDateRange(input.year, input.month);
  if (input.mode === "day" && input.day) {
    const [y, m, d] = input.day.split("-").map(Number);
    const date = calendarDateUTC(y, m, d);
    return { start: date, end: date };
  }
  if (input.mode === "range" && input.rangeStart && input.rangeEnd) {
    const [sy, sm, sd] = input.rangeStart.split("-").map(Number);
    const [ey, em, ed] = input.rangeEnd.split("-").map(Number);
    return {
      start: calendarDateUTC(sy, sm, sd),
      end: calendarDateUTC(ey, em, ed),
    };
  }
  return getMonthDateRange(input.year, input.month);
}

function periodLabel(input: {
  mode: PnlPeriodMode;
  year: number;
  month: number;
  day?: string;
  rangeStart?: string;
  rangeEnd?: string;
}) {
  if (input.mode === "year") return String(input.year);
  if (input.mode === "month") {
    return `${input.year}-${String(input.month).padStart(2, "0")}`;
  }
  if (input.mode === "day" && input.day) return input.day;
  if (input.mode === "range" && input.rangeStart && input.rangeEnd) {
    return `${input.rangeStart} ~ ${input.rangeEnd}`;
  }
  return `${input.year}-${String(input.month).padStart(2, "0")}`;
}

async function loadExchangeRate(year: number, month: number) {
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
  const row = await prisma.exchangeRate.findUnique({ where: { yearMonth } });
  const rate = decimalToNumber(row?.rate);
  return rate && rate > 0 ? rate : DEFAULT_EXCHANGE_RATE;
}

async function loadLkimRate() {
  const rows = await listGlobalCostSettings();
  return (
    rows.find((row) => row.key === "lkim_maqis_per_crate")?.valueMyr ??
    DEFAULT_LKIM_RATE
  );
}

function driverTripAllowance(dispatch: {
  driverAllowanceAmount: unknown;
  payrollTrip: {
    tripAllowance: unknown;
    extraAllowance: unknown;
    crateReturnCommission: unknown;
  } | null;
}) {
  const fromDispatch = decimalToNumber(dispatch.driverAllowanceAmount);
  if (fromDispatch != null && fromDispatch > 0) return fromDispatch;

  const trip = dispatch.payrollTrip;
  if (!trip) return 0;

  return roundMoney(
    (decimalToNumber(trip.tripAllowance) ?? 0) +
      (decimalToNumber(trip.extraAllowance) ?? 0) +
      (decimalToNumber(trip.crateReturnCommission) ?? 0)
  );
}

const dispatchPnlSelect = {
  id: true,
  date: true,
  markets: true,
  driverName: true,
  driverAllowanceAmount: true,
  truckId: true,
  truck: { select: { plate: true } },
  payrollTrip: {
    select: {
      tripAllowance: true,
      extraAllowance: true,
      crateReturnCommission: true,
    },
  },
  lines: {
    select: {
      inboundLine: {
        select: {
          stallId: true,
          tongTypeId: true,
          quantity: true,
          dispatchStatus: true,
          mcDeliveryMode: true,
          tongType: { select: { code: true, isBox: true } },
          stall: { select: { market: { select: { code: true } } } },
          session: {
            select: {
              shipperId: true,
              pickupLocation: true,
              shipper: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  pickupLocation: true,
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

type DispatchPnlRow = {
  id: string;
  date: Date;
  markets: string[];
  driverName: string | null;
  driverAllowanceAmount: unknown;
  truckId: string;
  truck: { plate: string };
  payrollTrip: {
    tripAllowance: unknown;
    extraAllowance: unknown;
    crateReturnCommission: unknown;
  } | null;
  lines: Array<{
    inboundLine: {
      stallId: string;
      tongTypeId: string;
      quantity: unknown;
      dispatchStatus: string;
      mcDeliveryMode: string | null;
      tongType: { code: string; isBox: boolean } | null;
      stall: { market: { code: string } | null };
      session: {
        shipperId: string;
        pickupLocation: string | null;
        shipper: {
          id: string;
          code: string;
          name: string;
          pickupLocation: string | null;
        };
      };
    } | null;
  }>;
};

interface PnlComputationContext {
  exchangeRate: number;
  lkimRatePerCrate: number;
  routes: RouteMasterCostRow[];
  unloadRateMap: Awaited<ReturnType<typeof lookupUnloadRateMap>>;
  rentalRateByType: Map<string, number>;
  globalCosts: Awaited<ReturnType<typeof loadGlobalTripCostValues>>;
  truckById: Map<
    string,
    {
      fuelEfficiencyKmPerL: number | null;
      annualMileageKm: number | null;
      costItems: { annualAmount: number }[];
    }
  >;
  freightCtxCache: Map<string, FreightCtxCache>;
  freightCtxStallIds: Map<string, Set<string>>;
  freightCtxTongTypeIds: Map<string, Set<string>>;
}

async function loadPnlComputationContext(
  year: number,
  month: number
): Promise<PnlComputationContext> {
  const [exchangeRate, lkimRatePerCrate, routeMasters, unloadRateMap, crateRentalRates, globalCosts, trucks] =
    await Promise.all([
      loadExchangeRate(year, month),
      loadLkimRate(),
      prisma.routeMaster.findMany({
        where: { active: true },
        select: {
          code: true,
          markets: true,
          sadooMileageKm: true,
          tollFee: true,
          fishCheckingFee: true,
          parkingFee: true,
        },
      }),
      lookupUnloadRateMap(),
      listCrateRentalRates(),
      loadGlobalTripCostValues(),
      prisma.truck.findMany({
        where: { active: true, country: "MY" },
        include: { costItems: true },
      }),
    ]);

  const routes: RouteMasterCostRow[] = routeMasters.map((route) => ({
    code: route.code,
    markets: route.markets,
    sadooMileageKm: decimalToNumber(route.sadooMileageKm),
    tollFee: decimalToNumber(route.tollFee),
    fishCheckingFee: decimalToNumber(route.fishCheckingFee),
    parkingFee: decimalToNumber(route.parkingFee),
  }));

  const truckById = new Map(
    trucks.map((truck) => [
      truck.id,
      {
        fuelEfficiencyKmPerL: decimalToNumber(truck.fuelEfficiencyKmPerL),
        annualMileageKm: truck.annualMileageKm,
        costItems: truck.costItems.map((item) => ({
          annualAmount: decimalToNumber(item.annualAmount) ?? 0,
        })),
      },
    ])
  );

  const rentalRateByType = new Map(
    crateRentalRates
      .filter((row) => row.isRental)
      .map((row) => [row.crateType, row.rateMyr])
  );

  return {
    exchangeRate,
    lkimRatePerCrate,
    routes,
    unloadRateMap,
    rentalRateByType,
    globalCosts,
    truckById,
    freightCtxCache: new Map(),
    freightCtxStallIds: new Map(),
    freightCtxTongTypeIds: new Map(),
  };
}

function countTripCratesFromLines(
  lines: Array<{
    inboundLine: {
      quantity: unknown;
      dispatchStatus: string;
    } | null;
  }>
): number {
  let total = 0;
  for (const line of lines) {
    const inbound = line.inboundLine;
    if (!inbound || inbound.dispatchStatus !== "assigned") continue;
    const quantity = decimalToNumber(inbound.quantity) ?? 0;
    if (quantity > 0) total += quantity;
  }
  return total;
}
async function computeTripPnlRow(
  dispatch: DispatchPnlRow,
  ctx: PnlComputationContext,
  asOfDate: Date
): Promise<PnlTripRow | null> {
  const routeGroups = getRouteGroups(dispatch.markets);
  const routeLabel = getRouteLabel(dispatch.markets);
  const routeKey = buildRouteKey(dispatch.markets);

  const applicableRoutes = findApplicableRoutes(dispatch.markets, ctx.routes);
  const routeCosts = computeTripRouteCosts(applicableRoutes, ctx.globalCosts);
  const truck = ctx.truckById.get(dispatch.truckId);
  const truckCosts = truck
    ? computeTripTruckCosts(
        routeCosts.tripMileageKm,
        truck,
        ctx.globalCosts.fuelPriceMyr
      )
    : { fuelMyr: 0, maintenanceMyr: 0 };

  const tripAllocated = {
    fuelMyr: truckCosts.fuelMyr,
    maintenanceMyr: truckCosts.maintenanceMyr,
    tollMyr: routeCosts.tollFee,
    borderPassMyr: routeCosts.borderPass,
    epermitMyr: routeCosts.epermit,
    dagangNetMyr: routeCosts.dagangNet,
    forwardingMyr: routeCosts.forwarding,
    driverMyr: driverTripAllowance(dispatch),
  };

  const shipperMap = new Map<
    string,
    {
      shipperId: string;
      shipperCode: string;
      shipperName: string;
      quantity: number;
      revenueMyr: number;
      crateRentalMyr: number;
      lkimMaqisMyr: number;
      unloadFeeMyr: number;
    }
  >();

  let tripQuantity = 0;
  let tripRevenue = 0;

  const lines = dispatch.lines
    .map((line) => line.inboundLine)
    .filter((line): line is NonNullable<typeof line> => line != null);

  const linesByShipper = new Map<string, typeof lines>();
  for (const line of lines) {
    const group = linesByShipper.get(line.session.shipperId) ?? [];
    group.push(line);
    linesByShipper.set(line.session.shipperId, group);
  }

  for (const [shipperId, shipperLines] of Array.from(linesByShipper.entries())) {
    const first = shipperLines[0];
    if (!first) continue;

    const assignedLines = shipperLines.filter(
      (line) => line.dispatchStatus === "assigned"
    );
    if (assignedLines.length === 0) continue;

    const pickup = resolveSessionPickupLocation(
      first.session.pickupLocation,
      first.session.shipper.pickupLocation
    );
    const stallIds = Array.from(
      new Set(assignedLines.map((line) => line.stallId))
    );
    const tongTypeIds = Array.from(
      new Set(assignedLines.map((line) => line.tongTypeId))
    );
    const freightCtx = await ensureFreightCtx(
      ctx.freightCtxCache,
      ctx.freightCtxStallIds,
      ctx.freightCtxTongTypeIds,
      shipperId,
      stallIds,
      tongTypeIds,
      pickup,
      asOfDate
    );

    for (const inbound of assignedLines) {
      if (!inbound.tongType?.code) continue;

      const marketCode = freightCtx.stalls.get(inbound.stallId)?.marketCode ?? "";
      if (!marketCode || isOtherMarket(marketCode)) continue;

      const quantity = decimalToNumber(inbound.quantity) ?? 0;
      if (quantity <= 0) continue;

      const snapshot = computeInboundLineFreight(
        {
          stallId: inbound.stallId,
          tongTypeId: inbound.tongTypeId,
          quantity,
          mcDeliveryMode: normalizeMcDeliveryMode(
            marketCode,
            inbound.mcDeliveryMode
          ),
        },
        freightCtx
      );

      const revenue = lineRevenueMyr(snapshot, ctx.exchangeRate);
      const crateType = inbound.tongType.code;
      const rentalRate = ctx.rentalRateByType.get(crateType) ?? 0;
      const crateRental = rentalRate > 0 ? quantity * rentalRate : 0;
      const lkim = quantity * ctx.lkimRatePerCrate;
      const unload =
        quantity *
        (ctx.unloadRateMap.get(unloadRateKey(marketCode, crateType)) ?? 0);

      const existing = shipperMap.get(shipperId) ?? {
        shipperId,
        shipperCode: inbound.session.shipper.code,
        shipperName: inbound.session.shipper.name,
        quantity: 0,
        revenueMyr: 0,
        crateRentalMyr: 0,
        lkimMaqisMyr: 0,
        unloadFeeMyr: 0,
      };

      existing.quantity += quantity;
      existing.revenueMyr = roundMoney(existing.revenueMyr + revenue);
      existing.crateRentalMyr = roundMoney(
        existing.crateRentalMyr + crateRental
      );
      existing.lkimMaqisMyr = roundMoney(existing.lkimMaqisMyr + lkim);
      existing.unloadFeeMyr = roundMoney(existing.unloadFeeMyr + unload);
      shipperMap.set(shipperId, existing);

      tripQuantity += quantity;
      tripRevenue = roundMoney(tripRevenue + revenue);
    }
  }

  if (tripQuantity <= 0) return null;

  const shippers: PnlShipperRow[] = Array.from(shipperMap.values()).map(
    (row) => {
      const directCostMyr = roundMoney(
        row.crateRentalMyr + row.lkimMaqisMyr + row.unloadFeeMyr
      );
      const allocatedFuelMyr = allocateShare(
        row.quantity,
        tripQuantity,
        tripAllocated.fuelMyr
      );
      const allocatedMaintenanceMyr = allocateShare(
        row.quantity,
        tripQuantity,
        tripAllocated.maintenanceMyr
      );
      const allocatedTollMyr = allocateShare(
        row.quantity,
        tripQuantity,
        tripAllocated.tollMyr
      );
      const allocatedBorderPassMyr = allocateShare(
        row.quantity,
        tripQuantity,
        tripAllocated.borderPassMyr
      );
      const allocatedEpermitMyr = allocateShare(
        row.quantity,
        tripQuantity,
        tripAllocated.epermitMyr
      );
      const allocatedDagangNetMyr = allocateShare(
        row.quantity,
        tripQuantity,
        tripAllocated.dagangNetMyr
      );
      const allocatedForwardingMyr = allocateShare(
        row.quantity,
        tripQuantity,
        tripAllocated.forwardingMyr
      );
      const allocatedDriverMyr = allocateShare(
        row.quantity,
        tripQuantity,
        tripAllocated.driverMyr
      );
      const allocatedCostMyr = roundMoney(
        allocatedFuelMyr +
          allocatedMaintenanceMyr +
          allocatedTollMyr +
          allocatedBorderPassMyr +
          allocatedEpermitMyr +
          allocatedDagangNetMyr +
          allocatedForwardingMyr +
          allocatedDriverMyr
      );
      const totalCostMyr = roundMoney(directCostMyr + allocatedCostMyr);
      const grossProfitMyr = roundMoney(row.revenueMyr - totalCostMyr);
      const marginPct =
        row.revenueMyr > 0
          ? roundMoney((grossProfitMyr / row.revenueMyr) * 100)
          : 0;

      return {
        ...row,
        directCostMyr,
        allocatedFuelMyr,
        allocatedMaintenanceMyr,
        allocatedTollMyr,
        allocatedBorderPassMyr,
        allocatedEpermitMyr,
        allocatedDagangNetMyr,
        allocatedForwardingMyr,
        allocatedDriverMyr,
        allocatedCostMyr,
        totalCostMyr,
        grossProfitMyr,
        marginPct,
      };
    }
  );

  const directCostMyr = roundMoney(
    shippers.reduce((sum, row) => sum + row.directCostMyr, 0)
  );
  const allocatedCostMyr = roundMoney(
    tripAllocated.fuelMyr +
      tripAllocated.maintenanceMyr +
      tripAllocated.tollMyr +
      tripAllocated.borderPassMyr +
      tripAllocated.epermitMyr +
      tripAllocated.dagangNetMyr +
      tripAllocated.forwardingMyr +
      tripAllocated.driverMyr
  );
  const totalCostMyr = roundMoney(directCostMyr + allocatedCostMyr);
  const grossProfitMyr = roundMoney(tripRevenue - totalCostMyr);
  const marginPct =
    tripRevenue > 0 ? roundMoney((grossProfitMyr / tripRevenue) * 100) : 0;

  return {
    dispatchOrderId: dispatch.id,
    date: toDateInputValue(dispatch.date),
    routeKey,
    routeLabel: routeLabel || routeKey || "—",
    routeGroups,
    driverName: dispatch.driverName,
    truckPlate: dispatch.truck.plate,
    totalQuantity: tripQuantity,
    revenueMyr: tripRevenue,
    directCostMyr,
    allocatedCostMyr,
    totalCostMyr,
    grossProfitMyr,
    marginPct,
    shippers: shippers.sort((a, b) => b.revenueMyr - a.revenueMyr),
  };
}

export async function buildPnlTripsList(input: {
  year: number;
  month: number;
  routeFilter?: PnlRouteFilter;
  driverFilter?: string;
}): Promise<PnlTripsListData> {
  const routeFilter = input.routeFilter ?? "ALL";
  const driverFilter = input.driverFilter ?? "ALL";
  const { start, end } = getMonthDateRange(input.year, input.month);

  const dispatches = await prisma.dispatchOrder.findMany({
    where: {
      status: { notIn: ["draft", "cancelled"] },
      date: { gte: start, lte: end },
    },
    select: {
      id: true,
      date: true,
      markets: true,
      driverName: true,
      truck: { select: { plate: true } },
      lines: {
        select: {
          inboundLine: {
            select: {
              quantity: true,
              dispatchStatus: true,
            },
          },
        },
      },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  const drivers = Array.from(
    new Set(
      dispatches
        .map((d) => d.driverName?.trim())
        .filter((name): name is string => Boolean(name))
    )
  ).sort((a, b) => a.localeCompare(b, "zh-Hans"));

  const trips: PnlTripListItem[] = [];
  for (const dispatch of dispatches) {
    const routeGroups = getRouteGroups(dispatch.markets);
    const routeLabel = getRouteLabel(dispatch.markets);
    const routeKey = buildRouteKey(dispatch.markets);

    if (!tripMatchesRouteFilter(routeGroups, routeFilter)) continue;
    if (!tripMatchesDriverFilter(dispatch.driverName, driverFilter)) continue;

    const totalCrates = countTripCratesFromLines(dispatch.lines);
    if (totalCrates <= 0) continue;

    trips.push({
      tripId: dispatch.id,
      date: toDateInputValue(dispatch.date),
      route: routeLabel || routeKey || "—",
      driver: dispatch.driverName,
      plate: dispatch.truck.plate,
      totalCrates,
    });
  }

  return {
    year: input.year,
    month: input.month,
    drivers,
    trips,
  };
}

export async function buildPnlTripDetail(input: {
  tripId: string;
  year: number;
  month: number;
}): Promise<PnlTripRow> {
  const dispatch = (await prisma.dispatchOrder.findUnique({
    where: { id: input.tripId },
    select: dispatchPnlSelect,
  })) as DispatchPnlRow | null;

  if (!dispatch) {
    throw new Error("趟次不存在 Trip not found");
  }

  const ctx = await loadPnlComputationContext(input.year, input.month);
  const { end } = getMonthDateRange(input.year, input.month);
  const trip = await computeTripPnlRow(dispatch, ctx, end);
  if (!trip) {
    throw new Error("该趟次无有效桶数 No assigned crates for this trip");
  }
  return trip;
}

export async function buildPnlPeriodSummary(input: {
  year: number;
  month: number;
  periodMode?: PnlPeriodMode;
  day?: string;
  rangeStart?: string;
  rangeEnd?: string;
}): Promise<PnlPeriodData> {
  const report = await buildPnlReport({
    ...input,
    periodMode: input.periodMode ?? "month",
    routeFilter: "ALL",
    driverFilter: "ALL",
  });
  return {
    year: report.year,
    month: report.month,
    periodSummary: report.periodSummary,
  };
}

export async function buildPnlCustomerAnalysis(input: {
  year: number;
  month: number;
  customerSort?: PnlCustomerSort;
}): Promise<PnlCustomerData> {
  const report = await buildPnlReport({
    year: input.year,
    month: input.month,
    customerSort: input.customerSort ?? "profit",
    routeFilter: "ALL",
    driverFilter: "ALL",
  });
  return {
    year: report.year,
    month: report.month,
    customers: report.customers,
    lossCustomers: report.lossCustomers,
  };
}

export async function buildPnlReport(input: {
  year: number;
  month: number;
  periodMode?: PnlPeriodMode;
  day?: string;
  rangeStart?: string;
  rangeEnd?: string;
  routeFilter?: PnlRouteFilter;
  driverFilter?: string;
  customerSort?: PnlCustomerSort;
}): Promise<PnlReportData> {
  const periodMode = input.periodMode ?? "month";
  const routeFilter = input.routeFilter ?? "ALL";
  const driverFilter = input.driverFilter ?? "ALL";
  const customerSort = input.customerSort ?? "profit";
  const { start, end } = resolveDateRange({
    mode: periodMode,
    year: input.year,
    month: input.month,
    day: input.day,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
  });

  const ctx = await loadPnlComputationContext(input.year, input.month);

  const dispatches = (await prisma.dispatchOrder.findMany({
    where: {
      status: { notIn: ["draft", "cancelled"] },
      date: { gte: start, lte: end },
    },
    select: dispatchPnlSelect,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  })) as DispatchPnlRow[];

  const drivers = Array.from(
    new Set(
      dispatches
        .map((d) => d.driverName?.trim())
        .filter((name): name is string => Boolean(name))
    )
  ).sort((a, b) => a.localeCompare(b, "zh-Hans"));

  const trips: PnlTripRow[] = [];

  for (const dispatch of dispatches) {
    const routeGroups = getRouteGroups(dispatch.markets);
    if (!tripMatchesRouteFilter(routeGroups, routeFilter)) continue;
    if (!tripMatchesDriverFilter(dispatch.driverName, driverFilter)) continue;

    const trip = await computeTripPnlRow(dispatch, ctx, end);
    if (trip) trips.push(trip);
  }

  const tripTotals: PnlTripTotals = {
    revenueMyr: roundMoney(trips.reduce((s, t) => s + t.revenueMyr, 0)),
    directCostMyr: roundMoney(trips.reduce((s, t) => s + t.directCostMyr, 0)),
    allocatedCostMyr: roundMoney(
      trips.reduce((s, t) => s + t.allocatedCostMyr, 0)
    ),
    totalCostMyr: roundMoney(trips.reduce((s, t) => s + t.totalCostMyr, 0)),
    grossProfitMyr: roundMoney(trips.reduce((s, t) => s + t.grossProfitMyr, 0)),
    marginPct: 0,
    tripCount: trips.length,
    totalQuantity: trips.reduce((s, t) => s + t.totalQuantity, 0),
  };
  tripTotals.marginPct =
    tripTotals.revenueMyr > 0
      ? roundMoney((tripTotals.grossProfitMyr / tripTotals.revenueMyr) * 100)
      : 0;

  const trendMap = new Map<string, PnlDailyTrendPoint>();
  for (const trip of trips) {
    const point = trendMap.get(trip.date) ?? {
      date: trip.date,
      revenueMyr: 0,
      costMyr: 0,
      profitMyr: 0,
    };
    point.revenueMyr = roundMoney(point.revenueMyr + trip.revenueMyr);
    point.costMyr = roundMoney(point.costMyr + trip.totalCostMyr);
    point.profitMyr = roundMoney(point.profitMyr + trip.grossProfitMyr);
    trendMap.set(trip.date, point);
  }

  const periodSummary: PnlPeriodSummary = {
    mode: periodMode,
    periodLabel: periodLabel({
      mode: periodMode,
      year: input.year,
      month: input.month,
      day: input.day,
      rangeStart: input.rangeStart,
      rangeEnd: input.rangeEnd,
    }),
    revenueMyr: tripTotals.revenueMyr,
    costMyr: tripTotals.totalCostMyr,
    grossProfitMyr: tripTotals.grossProfitMyr,
    marginPct: tripTotals.marginPct,
    tripCount: tripTotals.tripCount,
    totalQuantity: tripTotals.totalQuantity,
    trend: Array.from(trendMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    ),
  };

  const customerMap = new Map<string, PnlCustomerRow>();
  for (const trip of trips) {
    for (const shipper of trip.shippers) {
      const existing = customerMap.get(shipper.shipperId) ?? {
        shipperId: shipper.shipperId,
        shipperCode: shipper.shipperCode,
        shipperName: shipper.shipperName,
        totalQuantity: 0,
        revenueMyr: 0,
        directCostMyr: 0,
        allocatedCostMyr: 0,
        totalCostMyr: 0,
        grossProfitMyr: 0,
        profitPerCrate: 0,
        marginPct: 0,
        status: "normal" as PnlCustomerStatus,
      };
      existing.totalQuantity += shipper.quantity;
      existing.revenueMyr = roundMoney(existing.revenueMyr + shipper.revenueMyr);
      existing.directCostMyr = roundMoney(
        existing.directCostMyr + shipper.directCostMyr
      );
      existing.allocatedCostMyr = roundMoney(
        existing.allocatedCostMyr + shipper.allocatedCostMyr
      );
      existing.totalCostMyr = roundMoney(
        existing.totalCostMyr + shipper.totalCostMyr
      );
      existing.grossProfitMyr = roundMoney(
        existing.grossProfitMyr + shipper.grossProfitMyr
      );
      customerMap.set(shipper.shipperId, existing);
    }
  }

  const customers = Array.from(customerMap.values()).map((row) => {
    const marginPct =
      row.revenueMyr > 0
        ? roundMoney((row.grossProfitMyr / row.revenueMyr) * 100)
        : 0;
    const profitPerCrate =
      row.totalQuantity > 0
        ? roundMoney(row.grossProfitMyr / row.totalQuantity)
        : 0;
    return {
      ...row,
      marginPct,
      profitPerCrate,
      status: customerStatus(marginPct, row.grossProfitMyr),
    };
  });

  customers.sort((a, b) => {
    if (customerSort === "quantity") return b.totalQuantity - a.totalQuantity;
    if (customerSort === "revenue") return b.revenueMyr - a.revenueMyr;
    return b.grossProfitMyr - a.grossProfitMyr;
  });

  const lossCustomers: PnlCustomerSuggestion[] = customers
    .filter((row) => row.status === "loss" || row.status === "caution")
    .slice(0, 8)
    .map((row) => ({
      shipperCode: row.shipperCode,
      shipperName: row.shipperName,
      grossProfitMyr: row.grossProfitMyr,
      marginPct: row.marginPct,
      message:
        row.status === "loss"
          ? "该客户当月毛利为负，建议复核费率、路线组合与下货成本。"
          : "毛利率偏低，建议关注桶型结构、租桶费与路线分摊成本。",
    }));

  return {
    year: input.year,
    month: input.month,
    exchangeRate: ctx.exchangeRate,
    lkimRatePerCrate: ctx.lkimRatePerCrate,
    drivers,
    trips,
    tripTotals,
    periodSummary,
    customers,
    lossCustomers,
  };
}
