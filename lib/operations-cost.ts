import { isOtherMarket, sortMarkets } from "@/lib/markets";
import { decimalToNumber } from "@/lib/freight-rates";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { prisma } from "@/lib/prisma";
import { lookupUnloadRateMap } from "@/lib/unload-rates-service";
import { unloadRateKey } from "@/lib/constants/unload-rates";
import { listCrateRentalRates } from "@/lib/crate-rental-rates-service";
import { listGlobalCostSettings } from "@/lib/global-cost-settings-service";
import { DEFAULT_FUEL_PRICES } from "@/lib/constants/truck-cost";
import {
  calcFuelCostPerKm,
  calcTotalCostPerKm,
} from "@/lib/truck-cost";
import { normalizeTripMarkets } from "@/lib/trip-allowance";

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function buildRouteKey(markets: string[]) {
  return sortMarkets(
    markets.filter((code) => code && !isOtherMarket(code))
  ).join(" / ");
}

export interface RouteMasterCostRow {
  code: string;
  markets: string[];
  sadooMileageKm: number | null;
  tollFee: number | null;
  fishCheckingFee: number | null;
  parkingFee: number | null;
}

export interface GlobalTripCostValues {
  borderPass: number;
  epermit: number;
  dagangNet: number;
  forwardingOutbound: number;
  fuelPriceMyr: number;
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

function maxFee(values: (number | null | undefined)[]) {
  if (values.length === 0) return 0;
  return Math.max(...values.map((value) => value ?? 0));
}

function sumFees(values: (number | null | undefined)[]): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
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
  globalCosts: Pick<
    GlobalTripCostValues,
    "borderPass" | "epermit" | "dagangNet" | "forwardingOutbound"
  >
): TripRouteCosts {
  return {
    tripMileageKm: maxFee(applicableRoutes.map((route) => route.sadooMileageKm)),
    tollFee: maxFee(applicableRoutes.map((route) => route.tollFee)),
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
      byKey.get("fuel_price_myr") ??
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
    unloadRateMap,
    crateRentalRates,
    globalCosts,
    trucks,
  ] = await Promise.all([
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
    prisma.dispatchOrder.findMany({
      where: {
        status: { not: "cancelled" },
        date: { gte: start, lte: end },
      },
      select: {
        id: true,
        markets: true,
        truckId: true,
        lines: {
          select: {
            inboundLine: {
              select: {
                quantity: true,
                stall: {
                  select: {
                    market: {
                      select: { code: true },
                    },
                  },
                },
                tongType: {
                  select: {
                    code: true,
                  },
                },
              },
            },
          },
        },
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

  const totals = emptyOperationsCostTotals();
  totals.tripCount = dispatches.length;
  totals.routeCount = new Set(
    dispatches.map((dispatch) => buildRouteKey(dispatch.markets))
  ).size;

  for (const dispatch of dispatches) {
    const applicableRoutes = findApplicableRoutes(dispatch.markets, routes);
    const routeCosts = computeTripRouteCosts(applicableRoutes, globalCosts);

    totals.tollFee += routeCosts.tollFee;
    totals.fishCheckingFee += routeCosts.fishCheckingFee;
    totals.parkingFee += routeCosts.parkingFee;
    totals.borderPass += routeCosts.borderPass;
    totals.epermit += routeCosts.epermit;
    totals.dagangNet += routeCosts.dagangNet;
    totals.forwarding += routeCosts.forwarding;
    totals.totalMileageKm += routeCosts.tripMileageKm;

    const truck = truckById.get(dispatch.truckId);
    if (truck) {
      const truckCosts = computeTripTruckCosts(
        routeCosts.tripMileageKm,
        truck,
        globalCosts.fuelPriceMyr
      );
      totals.fuelMyr += truckCosts.fuelMyr;
      totals.maintenanceMyr += truckCosts.maintenanceMyr;
    }

    for (const line of dispatch.lines) {
      const inboundLine = line.inboundLine;
      if (!inboundLine?.tongType?.code) continue;

      const marketCode = inboundLine.stall?.market?.code;
      if (!marketCode || isOtherMarket(marketCode)) continue;

      const quantity = decimalToNumber(inboundLine.quantity) ?? 0;
      if (quantity <= 0) continue;

      const crateType = inboundLine.tongType.code;
      const unloadRate =
        unloadRateMap.get(unloadRateKey(marketCode, crateType)) ?? 0;
      totals.loadUnloadFee += quantity * unloadRate;

      const rentalRate = rentalRateByType.get(crateType);
      if (rentalRate != null && Number.isFinite(rentalRate)) {
        totals.crateRental += quantity * rentalRate;
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
