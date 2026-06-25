import { isOtherMarket, sortMarkets } from "@/lib/markets";
import { decimalToNumber } from "@/lib/freight-rates";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { prisma } from "@/lib/prisma";
import { getUnloadingRatesByMarket } from "@/lib/driver-expense-service";
import { resolveTripLoadUnloadCost } from "@/lib/unloading-trip-cost";
import { listCrateRentalRates } from "@/lib/crate-rental-rates-service";
import {
  buildCrateRentalMyrRateMap,
  computeCrateRentalLineCostMyr,
} from "@/lib/crate-rental-cost";
import { loadExchangeRate } from "@/lib/exchange-rate";
import { listGlobalCostSettings } from "@/lib/global-cost-settings-service";
import { DEFAULT_FUEL_PRICES } from "@/lib/constants/truck-cost";
import {
  computeTripRouteCosts,
  computeTripTruckCosts,
  findApplicableRoutes,
  resolveRouteTollFee,
  type RouteMasterCostRow,
  type TripRouteCosts,
  type TripTruckCosts,
} from "@/lib/trip-route-cost";
import { normalizeTripMarkets } from "@/lib/trip-allowance";
import {
  effectiveMarketsForTripCost,
  mcAssignedLinesFromDispatchLines,
} from "@/lib/mc-dispatch-delivery";

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Dispatch whose only market is OTHER (typically charter-linked cargo). */
function isOtherOnlyDispatch(markets: string[] | string): boolean {
  const normalized = normalizeTripMarkets(markets);
  return normalized.length === 1 && isOtherMarket(normalized[0]);
}

export function buildRouteKey(markets: string[]) {
  return sortMarkets(
    markets.filter((code) => code && !isOtherMarket(code))
  ).join(" / ");
}

export type { RouteMasterCostRow, TripRouteCosts, TripTruckCosts };

export {
  computeTripRouteCosts,
  computeTripTruckCosts,
  findApplicableRoutes,
  resolveRouteTollFee,
};

export interface OperationsCostTotals {
  fuelMyr: number;
  maintenanceMyr: number;
  tollFee: number;
  fishCheckingFee: number;
  parkingFee: number;
  borderPass: number;
  epermit: number;
  dagangNet: number;
  forwarding: number;
  crateRental: number;
  loadUnloadFee: number;
  tripCount: number;
  totalMileageKm: number;
  routeCount: number;
}

export interface GlobalTripCostValues {
  borderPass: number;
  epermit: number;
  dagangNet: number;
  forwardingOutbound: number;
  fuelPriceMyr: number;
}

export function emptyOperationsCostTotals(): OperationsCostTotals {
  return {
    fuelMyr: 0,
    maintenanceMyr: 0,
    tollFee: 0,
    fishCheckingFee: 0,
    parkingFee: 0,
    borderPass: 0,
    epermit: 0,
    dagangNet: 0,
    forwarding: 0,
    crateRental: 0,
    loadUnloadFee: 0,
    tripCount: 0,
    totalMileageKm: 0,
    routeCount: 0,
  };
}

export async function loadGlobalTripCostValues(): Promise<GlobalTripCostValues> {
  const [globalCosts, fuelPriceRow] = await Promise.all([
    listGlobalCostSettings(),
    prisma.fuelPrice.findUnique({ where: { id: "default" } }),
  ]);

  const byKey = new Map(globalCosts.map((row) => [row.key, row.valueMyr]));

  return {
    borderPass: byKey.get("border_pass") ?? 0,
    epermit: byKey.get("epermit") ?? 0,
    dagangNet: byKey.get("dagang_net") ?? 0,
    forwardingOutbound: byKey.get("forwarding_outbound") ?? 0,
    fuelPriceMyr:
      decimalToNumber(fuelPriceRow?.myrPerLiter) ??
      DEFAULT_FUEL_PRICES.myrPerLiter,
  };
}

export async function aggregateOperationsCosts(
  year: number,
  month: number
): Promise<OperationsCostTotals> {
  const { start, end } = getMonthDateRange(year, month);

  const [
    routeMasters,
    dispatches,
    unloadingRatesByMarket,
    crateRentalRates,
    globalCosts,
    trucks,
    unloadingFees,
    crateLoadingFees,
    vouchers,
    exchangeRate,
  ] = await Promise.all([
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
    prisma.dispatchOrder.findMany({
      where: {
        status: { not: "cancelled" },
        date: { gte: start, lte: end },
      },
      select: {
        id: true,
        markets: true,
        truckId: true,
        truck: { select: { type: true } },
        lines: {
          select: {
            inboundLine: {
              select: {
                dispatchStatus: true,
                quantity: true,
                mcDeliveryMode: true,
                stall: {
                  select: {
                    code: true,
                    market: {
                      select: { code: true },
                    },
                  },
                },
                tongType: {
                  select: {
                    code: true,
                    isBox: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    getUnloadingRatesByMarket(),
    listCrateRentalRates(),
    loadGlobalTripCostValues(),
    prisma.truck.findMany({
      where: { active: true, country: "MY" },
      select: {
        id: true,
        tollClass: true,
        fuelEfficiencyKmPerL: true,
        annualMileageKm: true,
        costItems: true,
      },
    }),
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
    }),
    prisma.crateLoadingFee.findMany({
      where: { tripDate: { gte: start, lte: end } },
      select: {
        tripId: true,
        loadingFee: true,
        loadingFeeOverride: true,
      },
    }),
    prisma.driverVoucher.findMany({
      where: { tripDate: { gte: start, lte: end } },
      select: {
        tripId: true,
        chopBorderAmt: true,
        chopBorderActual: true,
        parkingAmt: true,
        parkingActual: true,
        fishCheckAmt: true,
        fishCheckActual: true,
      },
    }),
    loadExchangeRate(year, month),
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
  const unloadingByTrip = new Map<string, typeof unloadingFees>();
  for (const row of unloadingFees) {
    const group = unloadingByTrip.get(row.tripId) ?? [];
    group.push(row);
    unloadingByTrip.set(row.tripId, group);
  }
  const loadingByTrip = new Map<string, typeof crateLoadingFees>();
  for (const row of crateLoadingFees) {
    const group = loadingByTrip.get(row.tripId) ?? [];
    group.push(row);
    loadingByTrip.set(row.tripId, group);
  }
  const voucherByTrip = new Map(vouchers.map((v) => [v.tripId, v]));

  const totals = emptyOperationsCostTotals();
  totals.tripCount = dispatches.length;
  totals.routeCount = new Set(
    dispatches.map((dispatch) => buildRouteKey(dispatch.markets))
  ).size;

  for (const dispatch of dispatches) {
    const otherOnly = isOtherOnlyDispatch(dispatch.markets);
    const mcAssignedLines = mcAssignedLinesFromDispatchLines(dispatch.lines);
    const effectiveMarkets = effectiveMarketsForTripCost(
      dispatch.markets,
      mcAssignedLines
    );
    const truck = truckById.get(dispatch.truckId);
    const applicableRoutes = findApplicableRoutes(effectiveMarkets, routes);
    const routeCosts = computeTripRouteCosts(
      applicableRoutes,
      globalCosts,
      truck?.tollClass
    );

    totals.tollFee += routeCosts.tollFee;
    const tripVoucher = voucherByTrip.get(dispatch.id);
    const tripFish =
      tripVoucher?.fishCheckActual ??
      tripVoucher?.fishCheckAmt ??
      routeCosts.fishCheckingFee;
    const tripParking =
      tripVoucher?.parkingActual ??
      tripVoucher?.parkingAmt ??
      routeCosts.parkingFee;
    const tripBorder =
      tripVoucher?.chopBorderActual ??
      tripVoucher?.chopBorderAmt ??
      routeCosts.borderPass;
    totals.fishCheckingFee += tripFish;
    totals.parkingFee += tripParking;
    if (!otherOnly) {
      totals.borderPass += tripBorder;
      totals.epermit += routeCosts.epermit;
      totals.dagangNet += routeCosts.dagangNet;
      totals.forwarding += routeCosts.forwarding;
    }
    totals.totalMileageKm += routeCosts.tripMileageKm;

    if (truck) {
      const truckCosts = computeTripTruckCosts(
        routeCosts.tripMileageKm,
        truck,
        globalCosts.fuelPriceMyr
      );
      totals.fuelMyr += truckCosts.fuelMyr;
      totals.maintenanceMyr += truckCosts.maintenanceMyr;
    }

    const tripUnloadingRows = unloadingByTrip.get(dispatch.id) ?? [];
    const tripLoadingRows = loadingByTrip.get(dispatch.id) ?? [];
    const tripLoadUnloadFee = resolveTripLoadUnloadCost({
      unloadingRows: tripUnloadingRows,
      loadingRows: tripLoadingRows,
      dispatchEstimate: dispatch,
      ratesByMarket: unloadingRatesByMarket,
    });
    totals.loadUnloadFee += otherOnly ? 0 : tripLoadUnloadFee;

    for (const line of dispatch.lines) {
      const inboundLine = line.inboundLine;
      if (!inboundLine?.tongType?.code) continue;

      const marketCode = inboundLine.stall?.market?.code;
      if (!marketCode || isOtherMarket(marketCode)) continue;

      const quantity = decimalToNumber(inboundLine.quantity) ?? 0;
      if (quantity <= 0) continue;

      const crateType = inboundLine.tongType.code;
      const rentalRate = rentalRateByType.get(crateType) ?? 0;
      if (rentalRate > 0) {
        totals.crateRental += computeCrateRentalLineCostMyr(quantity, rentalRate);
      }
    }
  }

  totals.fuelMyr = roundMoney(totals.fuelMyr);
  totals.maintenanceMyr = roundMoney(totals.maintenanceMyr);
  totals.tollFee = roundMoney(totals.tollFee);
  totals.fishCheckingFee = roundMoney(totals.fishCheckingFee);
  totals.parkingFee = roundMoney(totals.parkingFee);
  totals.borderPass = roundMoney(totals.borderPass);
  totals.epermit = roundMoney(totals.epermit);
  totals.dagangNet = roundMoney(totals.dagangNet);
  totals.forwarding = roundMoney(totals.forwarding);
  totals.crateRental = roundMoney(totals.crateRental);
  totals.loadUnloadFee = roundMoney(totals.loadUnloadFee);
  totals.totalMileageKm = roundMoney(totals.totalMileageKm);

  return totals;
}
