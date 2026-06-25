import { loadFleetPayrollAggregate } from "@/lib/payroll-fleet";
import { listCrateRentalRates } from "@/lib/crate-rental-rates-service";
import {
  buildCrateRentalMyrRateMap,
  computeCrateRentalLineCostMyr,
} from "@/lib/crate-rental-cost";
import { loadExchangeRate } from "@/lib/exchange-rate";
import { listGlobalCostSettings } from "@/lib/global-cost-settings-service";
import { loadInboundFreightContext } from "@/lib/freight-context";
import { decimalToNumber } from "@/lib/freight-rates";
import { isOtherMarket } from "@/lib/markets";
import {
  CHARTER_PNL_MARKET_CODE,
  CHARTER_UNSPECIFIED_CUSTOMER_ID,
  charterTripPnlSelect,
  computeCharterPnlRow,
  isCharterManualCustomerId,
  normalizeCharterBillToKey,
  type CharterTripPnlInput,
} from "@/lib/charter-pnl";
import {
  inboundLineStoredSnapshot,
} from "@/lib/inbound-freight";
import {
  effectiveMarketsForTripCost,
  lineMcThirdPartyHaulageMyr,
  mcAssignedLinesFromDispatchLines,
  pnlUnloadAllocatableQuantity,
  tripMcAllThirdParty,
  vehicleAllocatableQuantity,
} from "@/lib/mc-dispatch-delivery";
import {
  buildRouteKey,
  loadGlobalTripCostValues,
  type RouteMasterCostRow,
} from "@/lib/operations-cost";
import {
  allocateShipperVehicleCosts,
  allocateShipperVehicleTotalMyr,
  resolveTripAllocatedPool,
  sumTripAllocatedWithoutLoadUnload,
} from "@/lib/trip-cost-engine/trip-cost-facade";
import { legacyBuildTripAllocatedPool } from "@/lib/trip-cost-engine/legacy-adapter";
import type { TripCostLineInput } from "@/lib/trip-cost-engine/types";
import {
  getUnloadingRatesByMarket,
  type UnloadingDispatchEstimateInput,
} from "@/lib/driver-expense-service";
import type { UnloadingRateConfigInput } from "@/lib/unloading-calculator";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { parseThaiSegmentRates } from "@/lib/constants/thai-segment-rates";
import type { ThaiSegmentRates } from "@/lib/constants/thai-segment-rates";
import { getRouteLabel, getRouteGroups } from "@/lib/payroll-route-label";
import {
  calendarDateUTC,
  getMonthDateRange,
  getYearDateRange,
} from "@/lib/reports/period-report-shared";
import { prisma } from "@/lib/prisma";
import {
  getCachedPnlMonthTrips,
  getInflightPnlMonthTrips,
  pnlMonthTripsCacheKey,
  setCachedPnlMonthTrips,
  setInflightPnlMonthTrips,
  type PnlMonthTripsCacheEntry,
} from "@/lib/pnl-month-cache";
import { computeLineThaiSegmentCostMyr } from "@/lib/thai-segment-freight";
import { toDateInputValue } from "@/lib/date-utils";
import { lineRevenueMyr } from "@/lib/wtl-revenue";
import { isLogisticsPartnerShipper } from "@/lib/constants/shipper-kind";
import { aggregatePartnerFreightIncomeMyr } from "@/lib/partner-freight";
import { aggregateCrateReturnIncomeMyr } from "@/lib/crate-return-billing";
import { aggregateMonthlyInvoiceExtraChargesMyr } from "@/lib/monthly-invoice-extra-charges";
import type {
  PnlCustomerData,
  PnlCustomerMarketRow,
  PnlCustomerRow,
  PnlCustomerSort,
  PnlCustomerSortDir,
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
  PnlTripVehicleCosts,
  PnlTripsListData,
} from "@/lib/pnl-report-types";

export type {
  PnlCustomerData,
  PnlCustomerMarketRow,
  PnlCustomerRow,
  PnlCustomerSort,
  PnlCustomerSortDir,
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
  PnlTripVehicleCosts,
  PnlTripsListData,
} from "@/lib/pnl-report-types";
export { PNL_ROUTE_FILTERS } from "@/lib/pnl-report-types";

const PNL_TRIP_ROUTE_ORDER = [
  "KL",
  "MC",
  "BM",
  "A",
  "KD",
  "JB",
  "OTHER",
  "CHARTER",
] as const;

function pnlTripRouteSortIndex(routeGroups: string[]): number {
  for (let i = 0; i < PNL_TRIP_ROUTE_ORDER.length; i++) {
    if (routeGroups.includes(PNL_TRIP_ROUTE_ORDER[i])) return i;
  }
  return PNL_TRIP_ROUTE_ORDER.length;
}

function comparePnlTrips(a: PnlTripListItem, b: PnlTripListItem): number {
  const dateCmp = a.date.localeCompare(b.date);
  if (dateCmp !== 0) return dateCmp;
  const routeCmp =
    pnlTripRouteSortIndex(a.routeGroups) - pnlTripRouteSortIndex(b.routeGroups);
  if (routeCmp !== 0) return routeCmp;
  return a.route.localeCompare(b.route);
}

function resolveTripsDateRange(input: {
  year: number;
  month: number;
  day?: string | null;
}) {
  if (input.day) {
    const [y, m, d] = input.day.split("-").map(Number);
    const date = calendarDateUTC(y, m, d);
    return { start: date, end: date };
  }
  return getMonthDateRange(input.year, input.month);
}

const DEFAULT_LKIM_RATE_CRATE = 2.5;
const DEFAULT_LKIM_RATE_BOX = 1.0;

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function buildPnlDispatchUnloadingEstimate(
  dispatch: DispatchPnlRow
): UnloadingDispatchEstimateInput {
  return {
    truck: { type: dispatch.truck.type ?? null },
    lines: dispatch.lines.map((line) => ({
      inboundLine: line.inboundLine
        ? {
            dispatchStatus: line.inboundLine.dispatchStatus,
            quantity: line.inboundLine.quantity,
            stall: {
              code: line.inboundLine.stall.code,
              market: line.inboundLine.stall.market,
            },
            tongType: line.inboundLine.tongType,
          }
        : null,
    })),
  };
}

function buildPnlTripCostLines(
  dispatch: DispatchPnlRow,
  excludeMcFromUnloadAllocation: boolean
): TripCostLineInput[] {
  const lines: TripCostLineInput[] = [];
  for (const row of dispatch.lines) {
    const inbound = row.inboundLine;
    if (!inbound || inbound.dispatchStatus !== "assigned") continue;
    const marketCode = inbound.stall.market?.code ?? "";
    if (!marketCode || isOtherMarket(marketCode)) continue;
    const quantity = decimalToNumber(inbound.quantity) ?? 0;
    if (quantity <= 0) continue;
    const vehicleQty = vehicleAllocatableQuantity(
      marketCode,
      quantity,
      inbound.mcDeliveryMode
    );
    lines.push({
      lineId: `${dispatch.id}-${inbound.stallId}-${lines.length}`,
      shipperId: inbound.session.shipperId,
      marketCode,
      quantity,
      excludeFromVehicleAllocation: vehicleQty <= 0,
      unloadAllocatableQuantity: pnlUnloadAllocatableQuantity(
        marketCode,
        quantity,
        excludeMcFromUnloadAllocation
      ),
    });
  }
  return lines;
}

function resolvePnlTripCostBasis(
  dispatch: DispatchPnlRow,
  ctx: PnlComputationContext,
  effectiveMarkets: string[],
  routeGroups: string[],
  excludeMcFromUnloadAllocation: boolean
) {
  const truck = ctx.truckById.get(dispatch.truckId);
  const tripVoucher = ctx.voucherByTripId.get(dispatch.id);
  const tripUnloadingRows = ctx.unloadingByTripId.get(dispatch.id) ?? [];
  const tripLoadingRows = ctx.loadingByTripId.get(dispatch.id) ?? [];

  return resolveTripAllocatedPool({
    effectiveMarkets,
    routeGroups,
    routes: ctx.routes,
    globalCosts: ctx.globalCosts,
    tollClass: truck?.tollClass,
    truck: truck ?? null,
    voucher: tripVoucher ?? null,
    unloadingRows: tripUnloadingRows,
    loadingRows: tripLoadingRows,
    dispatchEstimate: buildPnlDispatchUnloadingEstimate(dispatch),
    ratesByMarket: ctx.unloadingRatesByMarket,
    driverMyr: driverTripAllowance(dispatch),
    costLines: buildPnlTripCostLines(dispatch, excludeMcFromUnloadAllocation),
  });
}

function allocateShare(part: number, total: number, amount: number) {
  if (total <= 0 || amount <= 0 || part <= 0) return 0;
  return roundMoney((part / total) * amount);
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
  _stallIdsByKey: Map<string, Set<string>>,
  _tongTypeIdsByKey: Map<string, Set<string>>,
  shipperId: string,
  stallIds: string[],
  tongTypeIds: string[],
  pickup: ReturnType<typeof resolveSessionPickupLocation>,
  asOfDate: Date
): Promise<FreightCtxCache> {
  const key = freightCtxCacheKey(shipperId, pickup, asOfDate);
  const cached = cache.get(key);
  if (cached) return cached;

  const { ctx } = await loadInboundFreightContext(
    shipperId,
    stallIds,
    tongTypeIds,
    asOfDate,
    pickup
  );
  cache.set(key, ctx);
  return ctx;
}

type FreightContextRequirement = {
  shipperId: string;
  pickup: ReturnType<typeof resolveSessionPickupLocation>;
  stallIds: Set<string>;
  tongTypeIds: Set<string>;
};

function collectFreightRequirementsFromDispatches(
  dispatches: DispatchPnlRow[],
  asOfDate: Date
): Map<string, FreightContextRequirement> {
  const requirements = new Map<string, FreightContextRequirement>();

  for (const dispatch of dispatches) {
    const lines = dispatch.lines
      .map((line) => line.inboundLine)
      .filter((line): line is NonNullable<typeof line> => line != null);

    const linesByShipper = new Map<string, typeof lines>();
    for (const line of lines) {
      if (line.dispatchStatus !== "assigned") continue;
      const group = linesByShipper.get(line.session.shipperId) ?? [];
      group.push(line);
      linesByShipper.set(line.session.shipperId, group);
    }

    for (const [shipperId, shipperLines] of Array.from(
      linesByShipper.entries()
    )) {
      const first = shipperLines[0];
      if (!first) continue;
      if (isLogisticsPartnerShipper(first.session.shipper)) continue;

      const pickup = resolveSessionPickupLocation(
        first.session.pickupLocation,
        first.session.shipper.pickupLocation
      );
      const key = freightCtxCacheKey(shipperId, pickup, asOfDate);
      const existing = requirements.get(key) ?? {
        shipperId,
        pickup,
        stallIds: new Set<string>(),
        tongTypeIds: new Set<string>(),
      };

      for (const line of shipperLines) {
        existing.stallIds.add(line.stallId);
        existing.tongTypeIds.add(line.tongTypeId);
      }
      requirements.set(key, existing);
    }
  }

  return requirements;
}

async function preloadPnlFreightContexts(
  ctx: PnlComputationContext,
  dispatches: DispatchPnlRow[],
  asOfDate: Date
): Promise<void> {
  const requirements = collectFreightRequirementsFromDispatches(
    dispatches,
    asOfDate
  );

  await Promise.all(
    Array.from(requirements.entries()).map(async ([key, req]) => {
      if (ctx.freightCtxCache.has(key)) return;

      const { ctx: freightCtx } = await loadInboundFreightContext(
        req.shipperId,
        Array.from(req.stallIds),
        Array.from(req.tongTypeIds),
        asOfDate,
        req.pickup
      );
      ctx.freightCtxCache.set(key, freightCtx);
      ctx.freightCtxStallIds.set(key, req.stallIds);
      ctx.freightCtxTongTypeIds.set(key, req.tongTypeIds);
    })
  );
}

function pnlTripRowToListItem(
  trip: PnlTripRow,
  meta: { routeLabel: string; routeGroups: string[] }
): PnlTripListItem {
  return {
    tripId: trip.dispatchOrderId,
    tripSource: trip.tripSource,
    date: trip.date,
    route: meta.routeLabel || trip.routeKey || "—",
    routeGroups: meta.routeGroups,
    driver: trip.driverName,
    plate: trip.truckPlate,
    totalCrates: trip.totalBarrelQty,
    totalBoxes: trip.totalBoxQty,
    revenueMyr: trip.revenueMyr,
    directCostMyr: trip.directCostMyr,
    allocatedCostMyr: trip.allocatedCostMyr,
    totalCostMyr: trip.totalCostMyr,
    grossProfitMyr: trip.grossProfitMyr,
    marginPct: trip.marginPct,
  };
}

function buildTripTotalsFromRows(trips: PnlTripRow[]): PnlTripTotals {
  const totalBarrelQty = trips.reduce((s, t) => s + t.totalBarrelQty, 0);
  const totalBoxQty = trips.reduce((s, t) => s + t.totalBoxQty, 0);
  const totals: PnlTripTotals = {
    revenueMyr: roundMoney(trips.reduce((s, t) => s + t.revenueMyr, 0)),
    partnerFreightMyr: 0,
    crateReturnIncomeMyr: 0,
    monthlyInvoiceExtraChargesMyr: 0,
    directCostMyr: roundMoney(trips.reduce((s, t) => s + t.directCostMyr, 0)),
    allocatedCostMyr: roundMoney(
      trips.reduce((s, t) => s + t.allocatedCostMyr, 0)
    ),
    totalCostMyr: roundMoney(trips.reduce((s, t) => s + t.totalCostMyr, 0)),
    grossProfitMyr: roundMoney(trips.reduce((s, t) => s + t.grossProfitMyr, 0)),
    marginPct: 0,
    tripCount: trips.length,
    totalQuantity: totalBarrelQty + totalBoxQty,
    totalBarrelQty,
    totalBoxQty,
  };
  totals.marginPct =
    totals.revenueMyr > 0
      ? roundMoney((totals.grossProfitMyr / totals.revenueMyr) * 100)
      : 0;
  return totals;
}

async function loadCharterTripsForPnl(
  start: Date,
  end: Date
): Promise<CharterTripPnlInput[]> {
  return prisma.charterTrip.findMany({
    where: { date: { gte: start, lte: end } },
    select: charterTripPnlSelect,
  }) as Promise<CharterTripPnlInput[]>;
}

async function computeCharterPnlRowsForFilters(input: {
  start: Date;
  end: Date;
  ctx: PnlComputationContext;
  routeFilter: PnlRouteFilter;
  driverFilter: string;
}): Promise<PnlTripRow[]> {
  if (input.routeFilter !== "ALL") return [];

  const charters = await loadCharterTripsForPnl(input.start, input.end);
  const rows: PnlTripRow[] = [];

  for (const charter of charters) {
    if (!tripMatchesDriverFilter(charter.driverName, input.driverFilter)) {
      continue;
    }
    const row = computeCharterPnlRow(charter, input.ctx.globalCosts);
    if (row) rows.push(row);
  }

  return rows;
}

async function enrichTripTotalsWithPartnerFreight(
  totals: PnlTripTotals,
  year: number,
  month: number,
  day?: string | null
): Promise<PnlTripTotals> {
  const partnerFreightMyr = await aggregatePartnerFreightIncomeMyr(
    year,
    month,
    day
  );
  if (partnerFreightMyr <= 0) {
    return { ...totals, partnerFreightMyr: 0, crateReturnIncomeMyr: totals.crateReturnIncomeMyr ?? 0 };
  }
  const revenueMyr = roundMoney(totals.revenueMyr + partnerFreightMyr);
  const grossProfitMyr = roundMoney(totals.grossProfitMyr + partnerFreightMyr);
  return {
    ...totals,
    partnerFreightMyr,
    revenueMyr,
    grossProfitMyr,
    marginPct:
      revenueMyr > 0
        ? roundMoney((grossProfitMyr / revenueMyr) * 100)
        : 0,
  };
}

async function enrichTripTotalsWithCrateReturnIncome(
  totals: PnlTripTotals,
  year: number,
  month: number,
  day?: string | null
): Promise<PnlTripTotals> {
  const crateReturnIncomeMyr = await aggregateCrateReturnIncomeMyr(
    year,
    month,
    day
  );
  if (crateReturnIncomeMyr <= 0) {
    return { ...totals, crateReturnIncomeMyr: 0 };
  }
  const revenueMyr = roundMoney(totals.revenueMyr + crateReturnIncomeMyr);
  const grossProfitMyr = roundMoney(totals.grossProfitMyr + crateReturnIncomeMyr);
  return {
    ...totals,
    crateReturnIncomeMyr,
    revenueMyr,
    grossProfitMyr,
    marginPct:
      revenueMyr > 0
        ? roundMoney((grossProfitMyr / revenueMyr) * 100)
        : 0,
  };
}

async function enrichTripTotalsWithMonthlyInvoiceExtraCharges(
  totals: PnlTripTotals,
  year: number,
  month: number,
  day?: string | null
): Promise<PnlTripTotals> {
  const monthlyInvoiceExtraChargesMyr =
    await aggregateMonthlyInvoiceExtraChargesMyr(year, month, day);
  if (monthlyInvoiceExtraChargesMyr <= 0) {
    return { ...totals, monthlyInvoiceExtraChargesMyr: 0 };
  }
  const revenueMyr = roundMoney(
    totals.revenueMyr + monthlyInvoiceExtraChargesMyr
  );
  const grossProfitMyr = roundMoney(
    totals.grossProfitMyr + monthlyInvoiceExtraChargesMyr
  );
  return {
    ...totals,
    monthlyInvoiceExtraChargesMyr,
    revenueMyr,
    grossProfitMyr,
    marginPct:
      revenueMyr > 0
        ? roundMoney((grossProfitMyr / revenueMyr) * 100)
        : 0,
  };
}

async function enrichTripTotalsWithSupplementalIncome(
  totals: PnlTripTotals,
  year: number,
  month: number,
  day?: string | null
): Promise<PnlTripTotals> {
  const withPartner = await enrichTripTotalsWithPartnerFreight(
    totals,
    year,
    month,
    day
  );
  const withCrate = await enrichTripTotalsWithCrateReturnIncome(
    withPartner,
    year,
    month,
    day
  );
  return enrichTripTotalsWithMonthlyInvoiceExtraCharges(
    withCrate,
    year,
    month,
    day
  );
}

async function computeFilteredPnlTrips(input: {
  year: number;
  month: number;
  day?: string | null;
  routeFilter?: PnlRouteFilter;
  driverFilter?: string;
}): Promise<PnlMonthTripsCacheEntry> {
  const routeFilter = input.routeFilter ?? "ALL";
  const driverFilter = input.driverFilter ?? "ALL";
  const cacheKey = pnlMonthTripsCacheKey({
    year: input.year,
    month: input.month,
    day: input.day,
    routeFilter,
    driverFilter,
  });

  const cached = getCachedPnlMonthTrips(cacheKey);
  if (cached) return cached;

  const inflight = getInflightPnlMonthTrips(cacheKey);
  if (inflight) return inflight;

  const promise = (async (): Promise<PnlMonthTripsCacheEntry> => {
    const { start, end } = resolveTripsDateRange(input);
    const { end: monthEnd } = getMonthDateRange(input.year, input.month);
    const ctx = await loadPnlComputationContext(input.year, input.month);

    const dispatches = (await prisma.dispatchOrder.findMany({
      where: {
        status: { notIn: ["draft", "cancelled"] },
        date: { gte: start, lte: end },
      },
      select: dispatchPnlSelect,
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    })) as DispatchPnlRow[];

    await preloadPnlFreightContexts(ctx, dispatches, monthEnd);

    const matchedDispatches: DispatchPnlRow[] = [];
    for (const dispatch of dispatches) {
      const routeGroups = getRouteGroups(dispatch.markets);
      if (!tripMatchesRouteFilter(routeGroups, routeFilter)) continue;
      if (!tripMatchesDriverFilter(dispatch.driverName, driverFilter)) continue;
      matchedDispatches.push(dispatch);
    }

    const dispatchTrips = (
      await Promise.all(
        matchedDispatches.map((dispatch) =>
          computeTripPnlRow(dispatch, ctx, monthEnd)
        )
      )
    ).filter((trip): trip is PnlTripRow => trip != null);

    const charterTrips = await computeCharterPnlRowsForFilters({
      start,
      end,
      ctx,
      routeFilter,
      driverFilter,
    });

    const trips = [...dispatchTrips, ...charterTrips];

    const drivers = Array.from(
      new Set(
        [
          ...dispatches.map((d) => d.driverName?.trim()),
          ...charterTrips.map((t) => t.driverName?.trim()),
        ].filter((name): name is string => Boolean(name))
      )
    ).sort((a, b) => a.localeCompare(b, "zh-Hans"));

    trips.sort((a, b) =>
      comparePnlTrips(
        pnlTripRowToListItem(a, {
          routeLabel: a.routeLabel,
          routeGroups: a.routeGroups,
        }),
        pnlTripRowToListItem(b, {
          routeLabel: b.routeLabel,
          routeGroups: b.routeGroups,
        })
      )
    );

    const entry: PnlMonthTripsCacheEntry = {
      expiresAt: 0,
      drivers,
      trips,
      tripTotals: await enrichTripTotalsWithSupplementalIncome(
        buildTripTotalsFromRows(trips),
        input.year,
        input.month,
        input.day
      ),
    };
    setCachedPnlMonthTrips(cacheKey, entry);
    return getCachedPnlMonthTrips(cacheKey)!;
  })();

  setInflightPnlMonthTrips(cacheKey, promise);
  return promise;
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

function buildPeriodSummaryFromTrips(input: {
  year: number;
  month: number;
  mode: PnlPeriodMode;
  day?: string;
  rangeStart?: string;
  rangeEnd?: string;
  trips: PnlTripListItem[];
}): PnlPeriodSummary {
  const trendMap = new Map<string, PnlDailyTrendPoint>();
  for (const trip of input.trips) {
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
  const revenueMyr = roundMoney(input.trips.reduce((s, t) => s + t.revenueMyr, 0));
  const costMyr = roundMoney(input.trips.reduce((s, t) => s + t.totalCostMyr, 0));
  const grossProfitMyr = roundMoney(revenueMyr - costMyr);
  const totalBarrelQty = input.trips.reduce((s, t) => s + t.totalCrates, 0);
  const totalBoxQty = input.trips.reduce((s, t) => s + t.totalBoxes, 0);
  return {
    mode: input.mode,
    periodLabel: periodLabel({
      mode: input.mode,
      year: input.year,
      month: input.month,
      day: input.day,
      rangeStart: input.rangeStart,
      rangeEnd: input.rangeEnd,
    }),
    revenueMyr,
    costMyr,
    grossProfitMyr,
    marginPct: revenueMyr > 0 ? roundMoney((grossProfitMyr / revenueMyr) * 100) : 0,
    tripCount: input.trips.length,
    totalQuantity: totalBarrelQty + totalBoxQty,
    totalBarrelQty,
    totalBoxQty,
    trend: Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    fleetPayrollTotalMyr: null,
    pnlTripDriverAllowanceMyr: null,
    fleetPayrollIncrementalMyr: null,
    payrollVariableAllowanceMyr: null,
    netProfitAfterFleetPayrollMyr: null,
  };
}

function sumPnlTripDriverAllowanceMyr(trips: PnlTripRow[]): number {
  return roundMoney(
    trips
      .filter((trip) => trip.tripSource === "dispatch")
      .reduce((sum, trip) => sum + trip.vehicleCosts.driverMyr, 0)
  );
}

async function loadThaiSegmentRates() {
  const rows = await listGlobalCostSettings();
  return parseThaiSegmentRates(rows);
}

async function loadLkimRate() {
  const rows = await listGlobalCostSettings();
  return {
    crate:
      rows.find((row) => row.key === "lkim_maqis_per_crate")?.valueMyr ??
      DEFAULT_LKIM_RATE_CRATE,
    box:
      rows.find((row) => row.key === "lkim_maqis_per_box")?.valueMyr ??
      DEFAULT_LKIM_RATE_BOX,
  };
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
  truck: { select: { plate: true, type: true } },
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
          thirdPartyFee: true,
          freightAmount: true,
          freightRate: true,
          currency: true,
          paymentMode: true,
          billingCompany: true,
          consigneeId: true,
          paymentParty: true,
          mySegmentFreightRate: true,
          mySegmentFreightAmount: true,
          thFreightRate: true,
          thFreightAmount: true,
          dualPaymentWtlRate: true,
          dualPaymentWtlAmount: true,
          dualPaymentWtlConsigneeId: true,
          tongType: { select: { code: true, isBox: true } },
          stall: { select: { code: true, market: { select: { code: true } } } },
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
                  shipperKind: true,
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
  truck: { plate: string; type: string | null };
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
      thirdPartyFee: unknown;
      freightAmount: unknown;
      freightRate: unknown;
      currency: string | null;
      paymentMode: string | null;
      billingCompany: string | null;
      consigneeId: string | null;
      paymentParty: string | null;
      mySegmentFreightRate: unknown;
      mySegmentFreightAmount: unknown;
      thFreightRate: unknown;
      thFreightAmount: unknown;
      dualPaymentWtlRate: unknown;
      dualPaymentWtlAmount: unknown;
      dualPaymentWtlConsigneeId: string | null;
      tongType: { code: string; isBox: boolean } | null;
      stall: { market: { code: string } | null; code: string | null };
      session: {
        shipperId: string;
        pickupLocation: string | null;
        shipper: {
          id: string;
          code: string;
          name: string;
          pickupLocation: string | null;
          shipperKind: string;
        };
      };
    } | null;
  }>;
};

interface PnlComputationContext {
  exchangeRate: number;
  lkimRatePerCrate: number;
  lkimRatePerBox: number;
  thaiSegmentRates: ThaiSegmentRates;
  routes: RouteMasterCostRow[];
  rentalRateByType: Map<string, number>;
  globalCosts: Awaited<ReturnType<typeof loadGlobalTripCostValues>>;
  truckById: Map<
    string,
    {
      fuelEfficiencyKmPerL: number | null;
      annualMileageKm: number | null;
      tollClass: string | null;
      costItems: { annualAmount: number }[];
    }
  >;
  freightCtxCache: Map<string, FreightCtxCache>;
  freightCtxStallIds: Map<string, Set<string>>;
  freightCtxTongTypeIds: Map<string, Set<string>>;
  unloadingByTripId: Map<
    string,
    {
      unloadFee: number;
      unloadFeeOverride: number | null;
      kpbFee: number;
      kpbFeeOverride: number | null;
      isKpbExempt: boolean;
    }[]
  >;
  loadingByTripId: Map<
    string,
    {
      loadingFee: number;
      loadingFeeOverride: number | null;
    }[]
  >;
  unloadingRatesByMarket: Map<string, UnloadingRateConfigInput>;
  voucherByTripId: Map<
    string,
    {
      status: string;
      costAppliedAt: Date | null;
      chopBorderAmt: number | null;
      chopBorderActual: number | null;
      parkingAmt: number | null;
      parkingActual: number | null;
      fishCheckAmt: number | null;
      fishCheckActual: number | null;
      kpbActual: number | null;
      upahTurunActual: number | null;
    }
  >;
}

async function loadPnlComputationContext(
  year: number,
  month: number
): Promise<PnlComputationContext> {
  const { start, end } = getMonthDateRange(year, month);
  const [exchangeRate, lkimRates, thaiSegmentRates, routeMasters, crateRentalRates, globalCosts, trucks, unloadingFees, loadingFees, vouchers, unloadingRatesByMarket] =
    await Promise.all([
      loadExchangeRate(year, month),
      loadLkimRate(),
      loadThaiSegmentRates(),
      prisma.routeMaster.findMany({
        where: { active: true },
        select: {
          code: true,
          markets: true,
          sadooMileageKm: true,
          tollFee: true,
          tollFeeClass2: true,
          tollFeeClass3: true,
          fishCheckingFee: true,
          parkingFee: true,
        },
      }),
      listCrateRentalRates(),
      loadGlobalTripCostValues(),
      prisma.truck.findMany({
        where: { active: true, country: "MY" },
        include: { costItems: true },
      }),
      // Fail-open strategy: if actual-first tables cannot be read, keep report alive
      // with original estimate-based logic instead of crashing the API.
      prisma.unloadingFee.findMany({
        where: { tripDate: { gte: start, lte: end } },
        select: {
          tripId: true,
          unloadFee: true,
          unloadFeeOverride: true,
          kpbFee: true,
          kpbFeeOverride: true,
          isKpbExempt: true,
        },
      })
      .catch((error) => {
        console.error("PNL actual-first fallback: unloadingFee read failed", error);
        return [];
      }) as Promise<
        {
          tripId: string;
          unloadFee: number;
          unloadFeeOverride: number | null;
          kpbFee: number;
          kpbFeeOverride: number | null;
          isKpbExempt: boolean;
        }[]
      >,
      prisma.crateLoadingFee.findMany({
        where: { tripDate: { gte: start, lte: end } },
        select: {
          tripId: true,
          loadingFee: true,
          loadingFeeOverride: true,
        },
      })
      .catch((error) => {
        console.error(
          "PNL actual-first fallback: crateLoadingFee read failed",
          error
        );
        return [];
      }) as Promise<
        {
          tripId: string;
          loadingFee: number;
          loadingFeeOverride: number | null;
        }[]
      >,
      prisma.driverVoucher.findMany({
        where: { tripDate: { gte: start, lte: end } },
        select: {
          tripId: true,
          status: true,
          costAppliedAt: true,
          chopBorderAmt: true,
          chopBorderActual: true,
          parkingAmt: true,
          parkingActual: true,
          fishCheckAmt: true,
          fishCheckActual: true,
          kpbActual: true,
          upahTurunActual: true,
        },
      })
      .catch((error) => {
        console.error("PNL actual-first fallback: driverVoucher read failed", error);
        return [];
      }) as Promise<
        {
          tripId: string;
          status: string;
          costAppliedAt: Date | null;
          chopBorderAmt: number | null;
          chopBorderActual: number | null;
          parkingAmt: number | null;
          parkingActual: number | null;
          fishCheckAmt: number | null;
          fishCheckActual: number | null;
          kpbActual: number | null;
          upahTurunActual: number | null;
        }[]
      >,
      getUnloadingRatesByMarket(),
    ]);

  const routes: RouteMasterCostRow[] = routeMasters.map((route) => ({
    code: route.code,
    markets: route.markets,
    sadooMileageKm: decimalToNumber(route.sadooMileageKm),
    tollFee: decimalToNumber(route.tollFee),
    tollFeeClass2: decimalToNumber(route.tollFeeClass2),
    tollFeeClass3: decimalToNumber(route.tollFeeClass3),
    fishCheckingFee: decimalToNumber(route.fishCheckingFee),
    parkingFee: decimalToNumber(route.parkingFee),
  }));

  const truckById = new Map(
    trucks.map((truck) => [
      truck.id,
      {
        fuelEfficiencyKmPerL: decimalToNumber(truck.fuelEfficiencyKmPerL),
        annualMileageKm: truck.annualMileageKm,
        tollClass: truck.tollClass,
        costItems: truck.costItems.map((item) => ({
          annualAmount: decimalToNumber(item.annualAmount) ?? 0,
        })),
      },
    ])
  );

  const rentalRateByType = buildCrateRentalMyrRateMap(crateRentalRates, exchangeRate);

  const unloadingByTripId = new Map<
    string,
    {
      unloadFee: number;
      unloadFeeOverride: number | null;
      kpbFee: number;
      kpbFeeOverride: number | null;
      isKpbExempt: boolean;
    }[]
  >();
  for (const row of unloadingFees) {
    const group = unloadingByTripId.get(row.tripId) ?? [];
    group.push(row);
    unloadingByTripId.set(row.tripId, group);
  }
  const loadingByTripId = new Map<
    string,
    {
      loadingFee: number;
      loadingFeeOverride: number | null;
    }[]
  >();
  for (const row of loadingFees) {
    const group = loadingByTripId.get(row.tripId) ?? [];
    group.push(row);
    loadingByTripId.set(row.tripId, group);
  }
  const voucherByTripId = new Map(
    vouchers.map((v) => [
      v.tripId,
      {
        status: v.status,
        costAppliedAt: v.costAppliedAt,
        chopBorderAmt: decimalToNumber(v.chopBorderAmt),
        chopBorderActual: decimalToNumber(v.chopBorderActual),
        parkingAmt: decimalToNumber(v.parkingAmt),
        parkingActual: decimalToNumber(v.parkingActual),
        fishCheckAmt: decimalToNumber(v.fishCheckAmt),
        fishCheckActual: decimalToNumber(v.fishCheckActual),
        kpbActual: decimalToNumber(v.kpbActual),
        upahTurunActual: decimalToNumber(v.upahTurunActual),
      },
    ])
  );

  return {
    exchangeRate,
    lkimRatePerCrate: lkimRates.crate,
    lkimRatePerBox: lkimRates.box,
    thaiSegmentRates,
    routes,
    rentalRateByType,
    globalCosts,
    truckById,
    freightCtxCache: new Map(),
    freightCtxStallIds: new Map(),
    freightCtxTongTypeIds: new Map(),
    unloadingByTripId,
    loadingByTripId,
    unloadingRatesByMarket,
    voucherByTripId,
  };
}

async function computeTripPnlRow(
  dispatch: DispatchPnlRow,
  ctx: PnlComputationContext,
  asOfDate: Date
): Promise<PnlTripRow | null> {
  const routeGroups = getRouteGroups(dispatch.markets);
  const routeLabel = getRouteLabel(dispatch.markets);
  const routeKey = buildRouteKey(dispatch.markets);

  const mcAssignedLines = mcAssignedLinesFromDispatchLines(dispatch.lines);
  const excludeMcFromUnloadAllocation = tripMcAllThirdParty(mcAssignedLines);
  const effectiveMarkets = effectiveMarketsForTripCost(
    dispatch.markets,
    mcAssignedLines
  );

  const costBasis = resolvePnlTripCostBasis(
    dispatch,
    ctx,
    effectiveMarkets,
    routeGroups,
    excludeMcFromUnloadAllocation
  );
  const tripAllocated = costBasis.pool;
  const legacyTripAllocated = legacyBuildTripAllocatedPool({
    vehiclePool: costBasis.vehiclePool,
    borderPassMyr: tripAllocated.borderPassMyr,
    fishCheckingMyr: tripAllocated.fishCheckingMyr,
    parkingMyr: tripAllocated.parkingMyr,
    driverMyr: tripAllocated.driverMyr,
  });

  const shipperMap = new Map<
    string,
    {
      shipperId: string;
      shipperCode: string;
      shipperName: string;
      quantity: number;
      barrelQty: number;
      boxQty: number;
      revenueMyr: number;
      crateRentalMyr: number;
      lkimMaqisMyr: number;
      thaiSegmentMyr: number;
      unloadFeeMyr: number;
      mcThirdPartyHaulageMyr: number;
      unloadAllocatableQuantity: number;
    }
  >();

  let tripQuantity = 0;
  let tripBarrelQty = 0;
  let tripBoxQty = 0;
  let totalTripQuantity = 0;
  let unloadTripQuantity = 0;
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
    if (isLogisticsPartnerShipper(first.session.shipper)) continue;

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

      totalTripQuantity += quantity;
      unloadTripQuantity += pnlUnloadAllocatableQuantity(
        marketCode,
        quantity,
        excludeMcFromUnloadAllocation
      );
    }
  }

  if (totalTripQuantity <= 0) return null;

  const vehicleAllocationDenominator = totalTripQuantity;
  const unloadAllocationDenominator =
    excludeMcFromUnloadAllocation && unloadTripQuantity > 0
      ? unloadTripQuantity
      : totalTripQuantity;

  for (const [shipperId, shipperLines] of Array.from(linesByShipper.entries())) {
    const first = shipperLines[0];
    if (!first) continue;
    if (isLogisticsPartnerShipper(first.session.shipper)) continue;

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

      const marketCode =
        inbound.stall.market?.code ??
        freightCtx.stalls.get(inbound.stallId)?.marketCode ??
        "";
      if (!marketCode || isOtherMarket(marketCode)) continue;

      const quantity = decimalToNumber(inbound.quantity) ?? 0;
      if (quantity <= 0) continue;

      const snapshot = inboundLineStoredSnapshot(
        inbound,
        ctx.exchangeRate,
        marketCode
      );

      const revenue = lineRevenueMyr(
        snapshot,
        ctx.exchangeRate,
        dispatch.date
      );
      const crateType = inbound.tongType.code;
      const rentalRate = ctx.rentalRateByType.get(crateType) ?? 0;
      const crateRental = computeCrateRentalLineCostMyr(quantity, rentalRate);
      const lkim =
        quantity *
        (inbound.tongType.isBox ? ctx.lkimRatePerBox : ctx.lkimRatePerCrate);
      const linePickup = resolveSessionPickupLocation(
        inbound.session.pickupLocation,
        inbound.session.shipper.pickupLocation
      );
      const thaiSegmentMyr = computeLineThaiSegmentCostMyr({
        pickupLocation: linePickup,
        quantity,
        isBox: inbound.tongType.isBox,
        freightAmount: inbound.freightAmount ?? snapshot.freightAmount,
        currency: inbound.currency ?? snapshot.currency,
        paymentMode: inbound.paymentMode ?? snapshot.paymentMode,
        exchangeRate: ctx.exchangeRate,
        rates: ctx.thaiSegmentRates,
        marketCode,
      });
      const mcThirdPartyHaulageMyr = lineMcThirdPartyHaulageMyr(inbound);
      const unloadAllocQty = pnlUnloadAllocatableQuantity(
        marketCode,
        quantity,
        excludeMcFromUnloadAllocation
      );
      const unload = allocateShare(
        unloadAllocQty,
        unloadAllocationDenominator,
        tripAllocated.loadUnloadMyr
      );

      const existing = shipperMap.get(shipperId) ?? {
        shipperId,
        shipperCode: inbound.session.shipper.code,
        shipperName: inbound.session.shipper.name,
        quantity: 0,
        barrelQty: 0,
        boxQty: 0,
        revenueMyr: 0,
        crateRentalMyr: 0,
        lkimMaqisMyr: 0,
        thaiSegmentMyr: 0,
        unloadFeeMyr: 0,
        mcThirdPartyHaulageMyr: 0,
        unloadAllocatableQuantity: 0,
      };

      existing.quantity += quantity;
      if (inbound.tongType.isBox) {
        existing.boxQty += quantity;
        tripBoxQty += quantity;
      } else {
        existing.barrelQty += quantity;
        tripBarrelQty += quantity;
      }
      existing.revenueMyr = roundMoney(existing.revenueMyr + revenue);
      existing.crateRentalMyr = roundMoney(
        existing.crateRentalMyr + crateRental
      );
      existing.lkimMaqisMyr = roundMoney(existing.lkimMaqisMyr + lkim);
      existing.thaiSegmentMyr = roundMoney(
        existing.thaiSegmentMyr + thaiSegmentMyr
      );
      existing.unloadFeeMyr = roundMoney(existing.unloadFeeMyr + unload);
      existing.mcThirdPartyHaulageMyr = roundMoney(
        existing.mcThirdPartyHaulageMyr + mcThirdPartyHaulageMyr
      );
      existing.unloadAllocatableQuantity += unloadAllocQty;
      shipperMap.set(shipperId, existing);

      tripQuantity += quantity;
      tripRevenue = roundMoney(tripRevenue + revenue);
    }
  }

  if (tripQuantity <= 0) return null;

  const tripAllocatedWithoutLoadUnload =
    sumTripAllocatedWithoutLoadUnload(tripAllocated);

  const shippers: PnlShipperRow[] = Array.from(shipperMap.values()).map(
    (row) => {
      const directCostMyr = roundMoney(
        row.crateRentalMyr +
          row.lkimMaqisMyr +
          row.thaiSegmentMyr +
          row.mcThirdPartyHaulageMyr
      );
      const vehicleAlloc = allocateShipperVehicleCosts({
        shipperId: row.shipperId,
        quantity: row.quantity,
        vehicleAllocationDenominator,
        tripAllocated: legacyTripAllocated,
        enforcedByShipper: costBasis.lineAllocationsByShipper,
      });
      const allocatedFuelMyr = vehicleAlloc.fuelMyr;
      const allocatedMaintenanceMyr = vehicleAlloc.maintenanceMyr;
      const allocatedTollMyr = vehicleAlloc.tollMyr;
      const allocatedBorderPassMyr = vehicleAlloc.borderPassMyr;
      const allocatedEpermitMyr = vehicleAlloc.epermitMyr;
      const allocatedDagangNetMyr = vehicleAlloc.dagangNetMyr;
      const allocatedForwardingMyr = vehicleAlloc.forwardingMyr;
      const allocatedDriverMyr = vehicleAlloc.driverMyr;
      const allocatedCostMyr = vehicleAlloc.allocatedCostMyr;
      const totalCostMyr = roundMoney(
        directCostMyr + row.unloadFeeMyr + allocatedCostMyr
      );
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
    shippers.reduce(
      (sum, row) =>
        sum + row.directCostMyr + row.unloadFeeMyr,
      0
    )
  );
  const allocatedCostMyr = tripAllocatedWithoutLoadUnload;
  const totalCostMyr = roundMoney(directCostMyr + allocatedCostMyr);
  const grossProfitMyr = roundMoney(tripRevenue - totalCostMyr);
  const marginPct =
    tripRevenue > 0 ? roundMoney((grossProfitMyr / tripRevenue) * 100) : 0;

  const vehicleCosts: PnlTripVehicleCosts = {
    fuelMyr: tripAllocated.fuelMyr,
    maintenanceMyr: tripAllocated.maintenanceMyr,
    tollMyr: tripAllocated.tollMyr,
    borderPassMyr: tripAllocated.borderPassMyr,
    epermitMyr: tripAllocated.epermitMyr,
    dagangNetMyr: tripAllocated.dagangNetMyr,
    forwardingMyr: tripAllocated.forwardingMyr,
    driverMyr: tripAllocated.driverMyr,
    totalMyr: tripAllocatedWithoutLoadUnload,
  };

  return {
    tripSource: "dispatch",
    dispatchOrderId: dispatch.id,
    date: toDateInputValue(dispatch.date),
    routeKey,
    routeLabel: routeLabel || routeKey || "—",
    routeGroups,
    driverName: dispatch.driverName,
    truckPlate: dispatch.truck.plate,
    totalQuantity: tripBarrelQty + tripBoxQty,
    totalBarrelQty: tripBarrelQty,
    totalBoxQty: tripBoxQty,
    revenueMyr: tripRevenue,
    directCostMyr,
    allocatedCostMyr,
    totalCostMyr,
    grossProfitMyr,
    marginPct,
    vehicleCosts,
    shippers: shippers.sort((a, b) => b.revenueMyr - a.revenueMyr),
  };
}

export async function buildPnlTripsList(input: {
  year: number;
  month: number;
  day?: string | null;
  routeFilter?: PnlRouteFilter;
  driverFilter?: string;
}): Promise<PnlTripsListData> {
  const computed = await computeFilteredPnlTrips(input);
  const trips = computed.trips.map((trip) =>
    pnlTripRowToListItem(trip, {
      routeLabel: trip.routeLabel,
      routeGroups: trip.routeGroups,
    })
  );

  return {
    year: input.year,
    month: input.month,
    day: input.day ?? null,
    drivers: computed.drivers,
    trips,
    totals: computed.tripTotals,
  };
}

async function appendCharterCustomerMarketRows(input: {
  shipperId: string;
  year: number;
  month: number;
  ctx: PnlComputationContext;
  marketMap: Map<
    string,
    {
      quantity: number;
      revenueMyr: number;
      crateRentalMyr: number;
      lkimMaqisMyr: number;
      thaiSegmentMyr: number;
      unloadFeeMyr: number;
      mcThirdPartyHaulageMyr: number;
      allocatedCostMyr: number;
      charterDirectMyr?: number;
    }
  >;
}) {
  const { start, end } = getMonthDateRange(input.year, input.month);
  const charters = await loadCharterTripsForPnl(start, end);

  const matched = charters.filter((trip) => {
    if (trip.shipper?.id === input.shipperId) return true;
    if (isCharterManualCustomerId(input.shipperId)) {
      const key = input.shipperId.slice("manual:".length);
      const billTo = trip.billToCustomerName?.trim();
      return !trip.shipperId && billTo
        ? normalizeCharterBillToKey(billTo) === key
        : false;
    }
    if (input.shipperId === CHARTER_UNSPECIFIED_CUSTOMER_ID) {
      return !trip.shipperId && !trip.billToCustomerName?.trim();
    }
    return false;
  });

  if (matched.length === 0) return;

  const existing = input.marketMap.get(CHARTER_PNL_MARKET_CODE) ?? {
    quantity: 0,
    revenueMyr: 0,
    crateRentalMyr: 0,
    lkimMaqisMyr: 0,
    thaiSegmentMyr: 0,
    unloadFeeMyr: 0,
    mcThirdPartyHaulageMyr: 0,
    allocatedCostMyr: 0,
  };

  for (const charter of matched) {
    const row = computeCharterPnlRow(charter, input.ctx.globalCosts);
    if (!row) continue;
    const shipper = row.shippers[0];
    if (!shipper) continue;

    existing.quantity += row.totalQuantity;
    existing.revenueMyr = roundMoney(existing.revenueMyr + row.revenueMyr);
    existing.crateRentalMyr = roundMoney(
      existing.crateRentalMyr + shipper.crateRentalMyr
    );
    existing.lkimMaqisMyr = roundMoney(
      existing.lkimMaqisMyr + shipper.lkimMaqisMyr
    );
    existing.unloadFeeMyr = roundMoney(
      existing.unloadFeeMyr + shipper.unloadFeeMyr
    );
    existing.allocatedCostMyr = roundMoney(
      existing.allocatedCostMyr + shipper.allocatedCostMyr
    );
    existing.charterDirectMyr = roundMoney(
      (existing.charterDirectMyr ?? 0) + row.directCostMyr
    );
  }

  input.marketMap.set(CHARTER_PNL_MARKET_CODE, existing);
}

export async function buildPnlCustomerMarketBreakdown(input: {
  shipperId: string;
  year: number;
  month: number;
}): Promise<PnlCustomerMarketRow[]> {
  const { start, end } = getMonthDateRange(input.year, input.month);
  const { end: monthEnd } = getMonthDateRange(input.year, input.month);
  const ctx = await loadPnlComputationContext(input.year, input.month);

  const dispatches = (await prisma.dispatchOrder.findMany({
    where: {
      status: { notIn: ["draft", "cancelled"] },
      date: { gte: start, lte: end },
      lines: {
        some: {
          inboundLine: {
            dispatchStatus: "assigned",
            session: { shipperId: input.shipperId },
          },
        },
      },
    },
    select: dispatchPnlSelect,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  })) as DispatchPnlRow[];

  await preloadPnlFreightContexts(ctx, dispatches, monthEnd);

  const marketMap = new Map<
    string,
    {
      quantity: number;
      revenueMyr: number;
      crateRentalMyr: number;
      lkimMaqisMyr: number;
      thaiSegmentMyr: number;
      unloadFeeMyr: number;
      mcThirdPartyHaulageMyr: number;
      allocatedCostMyr: number;
      charterDirectMyr?: number;
    }
  >();

  for (const dispatch of dispatches) {
    const routeGroups = getRouteGroups(dispatch.markets);
    const mcAssignedLines = mcAssignedLinesFromDispatchLines(dispatch.lines);
    const excludeMcFromUnloadAllocation = tripMcAllThirdParty(mcAssignedLines);
    const effectiveMarkets = effectiveMarketsForTripCost(
      dispatch.markets,
      mcAssignedLines
    );

    const costBasis = resolvePnlTripCostBasis(
      dispatch,
      ctx,
      effectiveMarkets,
      routeGroups,
      excludeMcFromUnloadAllocation
    );
    const tripAllocated = costBasis.pool;
    const tripAllocatedWithoutLoadUnload =
      sumTripAllocatedWithoutLoadUnload(tripAllocated);

    const lines = dispatch.lines
      .map((line) => line.inboundLine)
      .filter((line): line is NonNullable<typeof line> => line != null);

    let tripQuantity = 0;
    let unloadTripQuantity = 0;
    const shipperLines = lines.filter(
      (line) =>
        line.dispatchStatus === "assigned" &&
        line.session.shipperId === input.shipperId
    );
    if (shipperLines.length === 0) continue;

    for (const line of lines) {
      if (line.dispatchStatus !== "assigned") continue;
      const quantity = decimalToNumber(line.quantity) ?? 0;
      if (quantity <= 0) continue;
      const marketCode = line.stall.market?.code ?? "";
      if (!marketCode || isOtherMarket(marketCode)) continue;
      tripQuantity += quantity;
      unloadTripQuantity += pnlUnloadAllocatableQuantity(
        marketCode,
        quantity,
        excludeMcFromUnloadAllocation
      );
    }
    if (tripQuantity <= 0) continue;

    const vehicleAllocationDenominator = tripQuantity;
    const unloadAllocationDenominator =
      excludeMcFromUnloadAllocation && unloadTripQuantity > 0
        ? unloadTripQuantity
        : tripQuantity;

    const first = shipperLines[0]!;
    const pickup = resolveSessionPickupLocation(
      first.session.pickupLocation,
      first.session.shipper.pickupLocation
    );
    const stallIds = Array.from(new Set(shipperLines.map((line) => line.stallId)));
    const tongTypeIds = Array.from(
      new Set(shipperLines.map((line) => line.tongTypeId))
    );
    const freightCtx = await ensureFreightCtx(
      ctx.freightCtxCache,
      ctx.freightCtxStallIds,
      ctx.freightCtxTongTypeIds,
      input.shipperId,
      stallIds,
      tongTypeIds,
      pickup,
      monthEnd
    );

    for (const inbound of shipperLines) {
      if (!inbound.tongType?.code) continue;

      const marketCode =
        inbound.stall.market?.code ??
        freightCtx.stalls.get(inbound.stallId)?.marketCode ??
        "";
      if (!marketCode || isOtherMarket(marketCode)) continue;

      const quantity = decimalToNumber(inbound.quantity) ?? 0;
      if (quantity <= 0) continue;

      const snapshot = inboundLineStoredSnapshot(
        inbound,
        ctx.exchangeRate,
        marketCode
      );

      const revenue = lineRevenueMyr(
        snapshot,
        ctx.exchangeRate,
        dispatch.date
      );
      const crateType = inbound.tongType.code;
      const rentalRate = ctx.rentalRateByType.get(crateType) ?? 0;
      const crateRental = computeCrateRentalLineCostMyr(quantity, rentalRate);
      const lkim =
        quantity *
        (inbound.tongType.isBox ? ctx.lkimRatePerBox : ctx.lkimRatePerCrate);
      const linePickup = resolveSessionPickupLocation(
        inbound.session.pickupLocation,
        inbound.session.shipper.pickupLocation
      );
      const thaiSegmentMyr = computeLineThaiSegmentCostMyr({
        pickupLocation: linePickup,
        quantity,
        isBox: inbound.tongType.isBox,
        freightAmount: inbound.freightAmount ?? snapshot.freightAmount,
        currency: inbound.currency ?? snapshot.currency,
        paymentMode: inbound.paymentMode ?? snapshot.paymentMode,
        exchangeRate: ctx.exchangeRate,
        rates: ctx.thaiSegmentRates,
        marketCode,
      });
      const mcThirdPartyHaulageMyr = lineMcThirdPartyHaulageMyr(inbound);
      const unloadAllocQty = pnlUnloadAllocatableQuantity(
        marketCode,
        quantity,
        excludeMcFromUnloadAllocation
      );
      const unload = allocateShare(
        unloadAllocQty,
        unloadAllocationDenominator,
        tripAllocated.loadUnloadMyr
      );
      const allocatedCostMyr = allocateShipperVehicleTotalMyr({
        shipperId: input.shipperId,
        quantity,
        vehicleAllocationDenominator,
        tripAllocatedWithoutLoadUnload,
        enforcedByShipper: costBasis.lineAllocationsByShipper,
      });

      const existing = marketMap.get(marketCode) ?? {
        quantity: 0,
        revenueMyr: 0,
        crateRentalMyr: 0,
        lkimMaqisMyr: 0,
        thaiSegmentMyr: 0,
        unloadFeeMyr: 0,
        mcThirdPartyHaulageMyr: 0,
        allocatedCostMyr: 0,
      };

      existing.quantity += quantity;
      existing.revenueMyr = roundMoney(existing.revenueMyr + revenue);
      existing.crateRentalMyr = roundMoney(
        existing.crateRentalMyr + crateRental
      );
      existing.lkimMaqisMyr = roundMoney(existing.lkimMaqisMyr + lkim);
      existing.thaiSegmentMyr = roundMoney(
        existing.thaiSegmentMyr + thaiSegmentMyr
      );
      existing.unloadFeeMyr = roundMoney(existing.unloadFeeMyr + unload);
      existing.mcThirdPartyHaulageMyr = roundMoney(
        existing.mcThirdPartyHaulageMyr + mcThirdPartyHaulageMyr
      );
      existing.allocatedCostMyr = roundMoney(
        existing.allocatedCostMyr + allocatedCostMyr
      );
      marketMap.set(marketCode, existing);
    }
  }

  await appendCharterCustomerMarketRows({
    shipperId: input.shipperId,
    year: input.year,
    month: input.month,
    ctx,
    marketMap,
  });

  return Array.from(marketMap.entries())
    .map(([marketCode, row]) => {
      const directCostMyr =
        marketCode === CHARTER_PNL_MARKET_CODE && row.charterDirectMyr != null
          ? row.charterDirectMyr
          : roundMoney(
              row.crateRentalMyr +
                row.lkimMaqisMyr +
                row.thaiSegmentMyr +
                row.unloadFeeMyr +
                row.mcThirdPartyHaulageMyr
            );
      const totalCostMyr = roundMoney(directCostMyr + row.allocatedCostMyr);
      const grossProfitMyr = roundMoney(row.revenueMyr - totalCostMyr);
      const ratePerCrate =
        row.quantity > 0 ? roundMoney(row.revenueMyr / row.quantity) : 0;
      return {
        marketCode,
        quantity: row.quantity,
        ratePerCrate,
        revenueMyr: row.revenueMyr,
        crateRentalMyr: row.crateRentalMyr,
        lkimMaqisMyr: row.lkimMaqisMyr,
        thaiSegmentMyr: row.thaiSegmentMyr,
        unloadFeeMyr: row.unloadFeeMyr,
        mcThirdPartyHaulageMyr: row.mcThirdPartyHaulageMyr,
        allocatedCostMyr: row.allocatedCostMyr,
        totalCostMyr,
        grossProfitMyr,
      };
    })
    .sort((a, b) => a.marketCode.localeCompare(b.marketCode));
}

export async function buildPnlTripDetail(input: {
  tripId: string;
  year: number;
  month: number;
}): Promise<PnlTripRow> {
  const charter = (await prisma.charterTrip.findUnique({
    where: { id: input.tripId },
    select: charterTripPnlSelect,
  })) as CharterTripPnlInput | null;

  const ctx = await loadPnlComputationContext(input.year, input.month);

  if (charter) {
    const trip = computeCharterPnlRow(charter, ctx.globalCosts);
    if (!trip) {
      throw new Error("该趟次无有效桶数 No assigned crates for this trip");
    }
    return trip;
  }

  const dispatch = (await prisma.dispatchOrder.findUnique({
    where: { id: input.tripId },
    select: dispatchPnlSelect,
  })) as DispatchPnlRow | null;

  if (!dispatch) {
    throw new Error("趟次不存在 Trip not found");
  }

  const { end } = getMonthDateRange(input.year, input.month);
  await preloadPnlFreightContexts(ctx, [dispatch], end);
  const trip = await computeTripPnlRow(dispatch, ctx, end);
  if (!trip) {
    throw new Error("该趟次无有效桶数 No assigned crates for this trip");
  }
  return trip;
}

function compareCustomerRows(
  a: PnlCustomerRow,
  b: PnlCustomerRow,
  customerSort: PnlCustomerSort,
  sortDir: PnlCustomerSortDir
): number {
  let cmp = 0;
  if (customerSort === "quantity") {
    cmp = a.totalBarrelQty - b.totalBarrelQty;
  } else if (customerSort === "revenue") {
    cmp = a.revenueMyr - b.revenueMyr;
  } else if (customerSort === "margin") {
    cmp = a.marginPct - b.marginPct;
  } else {
    cmp = a.grossProfitMyr - b.grossProfitMyr;
  }
  return sortDir === "desc" ? -cmp : cmp;
}

function buildCustomersFromTrips(
  trips: PnlTripRow[],
  customerSort: PnlCustomerSort,
  sortDir: PnlCustomerSortDir = "desc"
): {
  customers: PnlCustomerRow[];
  lossCustomers: PnlCustomerSuggestion[];
} {
  const customerMap = new Map<string, PnlCustomerRow>();
  for (const trip of trips) {
    for (const shipper of trip.shippers) {
      const existing = customerMap.get(shipper.shipperId) ?? {
        shipperId: shipper.shipperId,
        shipperCode: shipper.shipperCode,
        shipperName: shipper.shipperName,
        totalQuantity: 0,
        totalBarrelQty: 0,
        totalBoxQty: 0,
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
      existing.totalBarrelQty += shipper.barrelQty;
      existing.totalBoxQty += shipper.boxQty;
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
      row.totalBarrelQty > 0
        ? roundMoney(row.grossProfitMyr / row.totalBarrelQty)
        : 0;
    return {
      ...row,
      marginPct,
      profitPerCrate,
      status: customerStatus(marginPct, row.grossProfitMyr),
    };
  });

  customers.sort((a, b) =>
    compareCustomerRows(a, b, customerSort, sortDir)
  );

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

  return { customers, lossCustomers   };
}

function mergePeriodSummaryWithTripTotals(
  summary: PnlPeriodSummary,
  tripTotals: PnlTripTotals
): PnlPeriodSummary {
  return {
    ...summary,
    revenueMyr: tripTotals.revenueMyr,
    grossProfitMyr: tripTotals.grossProfitMyr,
    marginPct: tripTotals.marginPct,
  };
}

async function enrichPeriodSummaryWithFleetPayroll(
  summary: PnlPeriodSummary,
  year: number,
  month: number,
  trips: PnlTripRow[]
): Promise<PnlPeriodSummary> {
  const payroll = await loadFleetPayrollAggregate(year, month, { sync: false });
  const fleetPayrollTotalMyr = roundMoney(payroll.totalCostMyr);
  const pnlTripDriverAllowanceMyr = sumPnlTripDriverAllowanceMyr(trips);
  const payrollVariableAllowanceMyr = roundMoney(
    payroll.totals.tripAllowanceTotal +
      payroll.totals.crateCommissionTotal +
      payroll.totals.extraAllowanceTotal
  );
  const fleetPayrollIncrementalMyr = roundMoney(
    fleetPayrollTotalMyr - pnlTripDriverAllowanceMyr
  );
  return {
    ...summary,
    fleetPayrollTotalMyr,
    pnlTripDriverAllowanceMyr,
    fleetPayrollIncrementalMyr,
    payrollVariableAllowanceMyr,
    netProfitAfterFleetPayrollMyr: roundMoney(
      summary.grossProfitMyr - fleetPayrollIncrementalMyr
    ),
  };
}

export async function buildPnlPeriodSummary(input: {
  year: number;
  month: number;
  periodMode?: PnlPeriodMode;
  day?: string;
  rangeStart?: string;
  rangeEnd?: string;
}): Promise<PnlPeriodData> {
  if ((input.periodMode ?? "month") === "month") {
    const computed = await computeFilteredPnlTrips({
      year: input.year,
      month: input.month,
      day: null,
      routeFilter: "ALL",
      driverFilter: "ALL",
    });
    const trips = computed.trips.map((trip) =>
      pnlTripRowToListItem(trip, {
        routeLabel: trip.routeLabel,
        routeGroups: trip.routeGroups,
      })
    );
    return {
      year: input.year,
      month: input.month,
      periodSummary: await enrichPeriodSummaryWithFleetPayroll(
        mergePeriodSummaryWithTripTotals(
          buildPeriodSummaryFromTrips({
            year: input.year,
            month: input.month,
            mode: "month",
            trips,
          }),
          computed.tripTotals
        ),
        input.year,
        input.month,
        computed.trips
      ),
    };
  }
  if ((input.periodMode ?? "month") === "day") {
    const computed = await computeFilteredPnlTrips({
      year: input.year,
      month: input.month,
      day: input.day?.trim() || null,
      routeFilter: "ALL",
      driverFilter: "ALL",
    });
    const trips = computed.trips.map((trip) =>
      pnlTripRowToListItem(trip, {
        routeLabel: trip.routeLabel,
        routeGroups: trip.routeGroups,
      })
    );
    return {
      year: input.year,
      month: input.month,
      periodSummary: mergePeriodSummaryWithTripTotals(
        buildPeriodSummaryFromTrips({
          year: input.year,
          month: input.month,
          mode: "day",
          day: input.day,
          trips,
        }),
        computed.tripTotals
      ),
    };
  }
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
  customerSortDir?: PnlCustomerSortDir;
}): Promise<PnlCustomerData> {
  const customerSort = input.customerSort ?? "profit";
  const customerSortDir = input.customerSortDir ?? "desc";
  const computed = await computeFilteredPnlTrips({
    year: input.year,
    month: input.month,
    day: null,
    routeFilter: "ALL",
    driverFilter: "ALL",
  });
  const { customers, lossCustomers } = buildCustomersFromTrips(
    computed.trips,
    customerSort,
    customerSortDir
  );
  return {
    year: input.year,
    month: input.month,
    customers,
    lossCustomers,
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
  customerSortDir?: PnlCustomerSortDir;
}): Promise<PnlReportData> {
  const periodMode = input.periodMode ?? "month";
  const routeFilter = input.routeFilter ?? "ALL";
  const driverFilter = input.driverFilter ?? "ALL";
  const customerSort = input.customerSort ?? "profit";
  const customerSortDir = input.customerSortDir ?? "desc";

  if (
    periodMode === "month" &&
    routeFilter === "ALL" &&
    driverFilter === "ALL" &&
    !input.day
  ) {
    const computed = await computeFilteredPnlTrips({
      year: input.year,
      month: input.month,
      day: null,
      routeFilter,
      driverFilter,
    });
    const ctx = await loadPnlComputationContext(input.year, input.month);
    const { customers, lossCustomers } = buildCustomersFromTrips(
      computed.trips,
      customerSort,
      customerSortDir
    );
    const trendMap = new Map<string, PnlDailyTrendPoint>();
    for (const trip of computed.trips) {
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
      }),
      revenueMyr: computed.tripTotals.revenueMyr,
      costMyr: computed.tripTotals.totalCostMyr,
      grossProfitMyr: computed.tripTotals.grossProfitMyr,
      marginPct: computed.tripTotals.marginPct,
      tripCount: computed.tripTotals.tripCount,
      totalQuantity: computed.tripTotals.totalQuantity,
      totalBarrelQty: computed.tripTotals.totalBarrelQty,
      totalBoxQty: computed.tripTotals.totalBoxQty,
      trend: Array.from(trendMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
      fleetPayrollTotalMyr: null,
      pnlTripDriverAllowanceMyr: null,
      fleetPayrollIncrementalMyr: null,
      payrollVariableAllowanceMyr: null,
      netProfitAfterFleetPayrollMyr: null,
    };
    return {
      year: input.year,
      month: input.month,
      exchangeRate: ctx.exchangeRate,
      lkimRatePerCrate: ctx.lkimRatePerCrate,
      drivers: computed.drivers,
      trips: computed.trips,
      tripTotals: computed.tripTotals,
      periodSummary,
      customers,
      lossCustomers,
    };
  }

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

  await preloadPnlFreightContexts(ctx, dispatches, end);

  const drivers = Array.from(
    new Set(
      dispatches
        .map((d) => d.driverName?.trim())
        .filter((name): name is string => Boolean(name))
    )
  ).sort((a, b) => a.localeCompare(b, "zh-Hans"));

  const matchedDispatches: DispatchPnlRow[] = [];
  for (const dispatch of dispatches) {
    const routeGroups = getRouteGroups(dispatch.markets);
    if (!tripMatchesRouteFilter(routeGroups, routeFilter)) continue;
    if (!tripMatchesDriverFilter(dispatch.driverName, driverFilter)) continue;
    matchedDispatches.push(dispatch);
  }
  const dispatchTrips = (await Promise.all(
    matchedDispatches.map((dispatch) => computeTripPnlRow(dispatch, ctx, end))
  )).filter((trip): trip is PnlTripRow => trip != null);

  const charterTrips = await computeCharterPnlRowsForFilters({
    start,
    end,
    ctx,
    routeFilter,
    driverFilter,
  });

  const trips = [...dispatchTrips, ...charterTrips];

  const driversWithCharter = Array.from(
    new Set(
      [
        ...drivers,
        ...charterTrips.map((t) => t.driverName?.trim()),
      ].filter((name): name is string => Boolean(name))
    )
  ).sort((a, b) => a.localeCompare(b, "zh-Hans"));

  const tripTotals = await enrichTripTotalsWithSupplementalIncome(
    buildTripTotalsFromRows(trips),
    input.year,
    input.month,
    input.day
  );

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
    totalBarrelQty: tripTotals.totalBarrelQty,
    totalBoxQty: tripTotals.totalBoxQty,
    trend: Array.from(trendMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    ),
    fleetPayrollTotalMyr: null,
    pnlTripDriverAllowanceMyr: null,
    fleetPayrollIncrementalMyr: null,
    payrollVariableAllowanceMyr: null,
    netProfitAfterFleetPayrollMyr: null,
  };

  const { customers, lossCustomers } = buildCustomersFromTrips(
    trips,
    customerSort,
    customerSortDir
  );

  return {
    year: input.year,
    month: input.month,
    exchangeRate: ctx.exchangeRate,
    lkimRatePerCrate: ctx.lkimRatePerCrate,
    drivers: driversWithCharter,
    trips,
    tripTotals,
    periodSummary,
    customers,
    lossCustomers,
  };
}

/** Shadow/snapshot read-only: dispatch P&L rows with shipper vehicle breakdown. */
export async function loadPnlDispatchTripRowsForPeriod(
  year: number,
  month: number
): Promise<PnlTripRow[]> {
  const computed = await computeFilteredPnlTrips({ year, month, day: null });
  return computed.trips.filter((trip) => trip.tripSource === "dispatch");
}
