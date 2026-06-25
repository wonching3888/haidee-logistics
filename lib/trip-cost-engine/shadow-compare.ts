/**
 * Pure shadow comparison: legacy vs leg-based enforced (Step 5).
 * Does not mutate P&L/operations output.
 */
import { getRouteGroups } from "@/lib/payroll-route-label";
import {
  effectiveMarketsForTripCost,
  vehicleAllocatableQuantity,
} from "@/lib/mc-dispatch-delivery";
import {
  legacyAllocateTripVehicleCosts,
  legacyBuildTripAllocatedPool,
  legacyResolveTripVehiclePool,
} from "@/lib/trip-cost-engine/legacy-adapter";
import {
  allocateTripLineCosts,
  type TripGlobalFeePool,
} from "@/lib/trip-cost-engine/line-cost-allocator";
import {
  buildVehicleLegPlan,
  isLineEligibleForLeg,
  routeGroupForLineMarket,
  type VehicleLegPlan,
} from "@/lib/trip-cost-engine/vehicle-leg-resolver";
import { resolveVoucherTripCosts } from "@/lib/trip-cost-engine/voucher-cost-resolver";
import type { TripCostLineInput, VoucherCostContext } from "@/lib/trip-cost-engine/types";
import type { RouteMasterCostRow } from "@/lib/trip-route-cost";
import type {
  CrateLoadingFeeCostRow,
  UnloadingFeeCostRow,
} from "@/lib/unloading-trip-cost";
import { resolveTripLoadUnloadCost } from "@/lib/unloading-trip-cost";
import { calcFuelCostPerKm } from "@/lib/truck-cost";

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Boss-confirmed near→far order (round-trip sadoo_mileage_km). */
export const EXPECTED_ROUTE_GROUP_MILEAGE_ORDER = [
  "KD",
  "BM",
  "A",
  "KL",
  "MC",
] as const;

export interface MileageAuditIssue {
  routeGroup: string;
  code: string;
  sadooMileageKm: number | null;
  issue: "missing" | "order_violation" | "duplicate_codes";
  detail: string;
}

export interface LegGroupShare {
  routeGroup: string;
  quantity: number;
  fuelMyr: number;
  maintenanceMyr: number;
  tollMyr: number;
  variableMyr: number;
}

export interface LegDetailRow {
  legIndex: number;
  toRouteGroup: string;
  distanceKm: number;
  legFuelMyr: number;
  legMaintenanceMyr: number;
  legTollMyr: number;
  byRouteGroup: LegGroupShare[];
}

export interface ShipperVehicleCompare {
  shipperId: string;
  shipperName: string;
  quantity: number;
  legacyVehicleMyr: number;
  enforcedVehicleMyr: number;
  deltaMyr: number;
}

export interface MarketQuantityRow {
  routeGroup: string;
  quantity: number;
  legacyVariableMyr: number;
  enforcedVariableMyr: number;
}

export interface TripVehicleShadowCompare {
  legacyPoolMyr: number;
  enforcedPoolMyr: number;
  conservationOk: boolean;
  conservationDeltaMyr: number;
  legacy: {
    fuelMyr: number;
    maintenanceMyr: number;
    tollMyr: number;
    globalMyr: number;
    totalMyr: number;
  };
  enforced: {
    fuelMyr: number;
    maintenanceMyr: number;
    tollMyr: number;
    globalMyr: number;
    totalMyr: number;
  };
  shippers: ShipperVehicleCompare[];
  markets: MarketQuantityRow[];
  legPlan: VehicleLegPlan;
  legDetails: LegDetailRow[];
  fuelPerKmMyr: number | null;
  maintenancePerKmMyr: number | null;
  mileageNote: string;
}

export interface VoucherGateShadowCompare {
  voucherStatus: string | null;
  costAppliedAt: string | null;
  legacyLoadUnloadMyr: number;
  enforcedLoadUnloadMyr: number;
  deltaMyr: number;
  gateWouldChange: boolean;
}

export interface ShadowDispatchLineInput {
  lineId: string;
  shipperId: string;
  shipperName: string;
  marketCode: string;
  quantity: number;
  mcDeliveryMode: string | null;
}

export interface CompareTripShadowInput {
  tripId: string;
  dispatchMarkets: string[];
  dispatchLines: ShadowDispatchLineInput[];
  routes: RouteMasterCostRow[];
  globalCosts: {
    borderPass: number;
    epermit: number;
    dagangNet: number;
    forwardingOutbound: number;
    fuelPriceMyr: number;
  };
  tollClass?: string | null;
  truck?: {
    fuelEfficiencyKmPerL: number | null;
    annualMileageKm: number | null;
    costItems: { annualAmount: number }[];
  } | null;
  driverMyr: number;
  tripBorderMyr: number;
  tripFishMyr: number;
  unloadingRows: UnloadingFeeCostRow[];
  loadingRows: CrateLoadingFeeCostRow[];
  dispatchEstimate?: Parameters<typeof resolveTripLoadUnloadCost>[0]["dispatchEstimate"];
  ratesByMarket?: Parameters<typeof resolveTripLoadUnloadCost>[0]["ratesByMarket"];
  routeCosts: {
    epermit: number;
    dagangNet: number;
    forwarding: number;
  };
  voucher?: VoucherCostContext | null;
  routeEstimates: {
    borderPassMyr: number;
    parkingMyr: number;
    fishCheckingMyr: number;
  };
  legacyShippers?: Array<{
    shipperId: string;
    shipperName: string;
    quantity: number;
    allocatedCostMyr: number;
  }>;
}

function buildTripCostLines(
  dispatchLines: ShadowDispatchLineInput[]
): TripCostLineInput[] {
  return dispatchLines.map((line) => {
    const vehicleQty = vehicleAllocatableQuantity(
      line.marketCode,
      line.quantity,
      line.mcDeliveryMode
    );
    return {
      lineId: line.lineId,
      shipperId: line.shipperId,
      marketCode: line.marketCode,
      quantity: line.quantity,
      excludeFromVehicleAllocation: vehicleQty <= 0,
    };
  });
}

function allocateShare(part: number, total: number, amount: number) {
  if (total <= 0 || amount <= 0 || part <= 0) return 0;
  return roundMoney((part / total) * amount);
}

function buildLegDetails(
  legPlan: VehicleLegPlan,
  lines: TripCostLineInput[]
): LegDetailRow[] {
  const groups = legPlan.routeGroups;
  return legPlan.legs.map((leg) => {
    const byGroup = new Map<string, LegGroupShare>();

    for (const line of lines) {
      const qty =
        line.excludeFromVehicleAllocation || line.quantity <= 0 ? 0 : line.quantity;
      if (qty <= 0) continue;
      const group = routeGroupForLineMarket(line.marketCode);
      if (!isLineEligibleForLeg(group, leg.legIndex, groups)) continue;

      const existing = byGroup.get(group) ?? {
        routeGroup: group,
        quantity: 0,
        fuelMyr: 0,
        maintenanceMyr: 0,
        tollMyr: 0,
        variableMyr: 0,
      };
      existing.quantity += qty;
      byGroup.set(group, existing);
    }

    const eligible = Array.from(byGroup.values());
    const denom = eligible.reduce((sum, row) => sum + row.quantity, 0);

    for (const row of eligible) {
      row.fuelMyr = allocateShare(row.quantity, denom, leg.fuelMyr);
      row.maintenanceMyr = allocateShare(row.quantity, denom, leg.maintenanceMyr);
      row.tollMyr = allocateShare(row.quantity, denom, leg.tollMyr);
      row.variableMyr = roundMoney(row.fuelMyr + row.maintenanceMyr + row.tollMyr);
    }

    return {
      legIndex: leg.legIndex,
      toRouteGroup: leg.toRouteGroup,
      distanceKm: leg.distanceKm,
      legFuelMyr: leg.fuelMyr,
      legMaintenanceMyr: leg.maintenanceMyr,
      legTollMyr: leg.tollMyr,
      byRouteGroup: eligible.sort((a, b) =>
        a.routeGroup.localeCompare(b.routeGroup)
      ),
    };
  });
}

function sumByShipper(
  allocations: ReturnType<typeof allocateTripLineCosts>["allocations"]
) {
  const map = new Map<string, number>();
  for (const row of allocations) {
    map.set(row.shipperId, (map.get(row.shipperId) ?? 0) + row.totalAllocatedMyr);
  }
  return map;
}

function sumVariableByRouteGroup(
  allocations: ReturnType<typeof allocateTripLineCosts>["allocations"]
) {
  const map = new Map<string, { qty: number; variable: number }>();
  for (const row of allocations) {
    const group = routeGroupForLineMarket(row.marketCode);
    const existing = map.get(group) ?? { qty: 0, variable: 0 };
    existing.qty += row.quantity;
    existing.variable += row.fuelMyr + row.maintenanceMyr + row.tollMyr;
    map.set(group, existing);
  }
  return map;
}

export function auditRouteMileageMaster(
  routes: RouteMasterCostRow[]
): MileageAuditIssue[] {
  const issues: MileageAuditIssue[] = [];
  const byGroup = new Map<string, RouteMasterCostRow[]>();

  for (const route of routes) {
    const group = route.code;
    const list = byGroup.get(group) ?? [];
    list.push(route);
    byGroup.set(group, list);
  }

  const points: { routeGroup: string; km: number; code: string }[] = [];

  for (const expected of EXPECTED_ROUTE_GROUP_MILEAGE_ORDER) {
    const rows = byGroup.get(expected) ?? [];
    if (rows.length === 0) continue;

    if (rows.length > 1) {
      issues.push({
        routeGroup: expected,
        code: rows.map((r) => r.code).join(","),
        sadooMileageKm: rows[0]?.sadooMileageKm ?? null,
        issue: "duplicate_codes",
        detail: `Multiple active routes for group ${expected}`,
      });
    }

    const row = rows[0];
    const km = row?.sadooMileageKm ?? null;
    if (km == null || km <= 0) {
      issues.push({
        routeGroup: expected,
        code: row?.code ?? expected,
        sadooMileageKm: km,
        issue: "missing",
        detail: `Missing or zero sadoo_mileage_km for ${expected}`,
      });
      continue;
    }

    points.push({ routeGroup: expected, km, code: row.code });
  }

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (curr.km < prev.km) {
      issues.push({
        routeGroup: curr.routeGroup,
        code: curr.code,
        sadooMileageKm: curr.km,
        issue: "order_violation",
        detail: `${curr.routeGroup}(${curr.km}km) < ${prev.routeGroup}(${prev.km}km) violates KD<BM<A<KL<MC`,
      });
    }
  }

  return issues;
}

export function compareTripVehicleShadow(
  input: CompareTripShadowInput
): TripVehicleShadowCompare {
  const mcLines = input.dispatchLines.map((line) => ({
    marketCode: line.marketCode,
    mcDeliveryMode: line.mcDeliveryMode,
  }));
  const effectiveMarkets = effectiveMarketsForTripCost(
    input.dispatchMarkets,
    mcLines
  );
  const routeGroups = getRouteGroups(effectiveMarkets);

  const vehiclePool = legacyResolveTripVehiclePool({
    dispatchMarkets: effectiveMarkets,
    routes: input.routes,
    globalCosts: input.globalCosts,
    tollClass: input.tollClass,
    truck: input.truck ?? null,
  });

  const tripAllocated = legacyBuildTripAllocatedPool({
    vehiclePool,
    borderPassMyr: input.tripBorderMyr,
    fishCheckingMyr: input.tripFishMyr,
    parkingMyr: 0,
    driverMyr: input.driverMyr,
  });

  const legacyGlobalMyr = roundMoney(
    tripAllocated.borderPassMyr +
      tripAllocated.fishCheckingMyr +
      tripAllocated.epermitMyr +
      tripAllocated.dagangNetMyr +
      tripAllocated.forwardingMyr +
      tripAllocated.driverMyr
  );
  const legacyVariableMyr = roundMoney(
    tripAllocated.fuelMyr + tripAllocated.maintenanceMyr + tripAllocated.tollMyr
  );
  const legacyPoolMyr = roundMoney(legacyGlobalMyr + legacyVariableMyr);

  const costLines = buildTripCostLines(input.dispatchLines);
  const legPlan = buildVehicleLegPlan({
    routeGroups,
    routes: input.routes,
    tollClass: input.tollClass,
    fuelPriceMyr: input.globalCosts.fuelPriceMyr,
    truck: input.truck ?? {
      fuelEfficiencyKmPerL: null,
      annualMileageKm: null,
      costItems: [],
    },
  });

  const globalFees: TripGlobalFeePool = {
    borderPassMyr: input.tripBorderMyr,
    fishCheckingMyr: input.tripFishMyr,
    epermitMyr: input.routeCosts.epermit,
    dagangNetMyr: input.routeCosts.dagangNet,
    forwardingMyr: input.routeCosts.forwarding,
    driverMyr: input.driverMyr,
  };

  const enforced = allocateTripLineCosts({
    lines: costLines,
    legPlan,
    globalFees,
  });

  const enforcedGlobalMyr = enforced.totals.totalGlobalMyr;
  const enforcedPoolMyr = enforced.totals.totalAllocatedMyr;
  const conservationDeltaMyr = roundMoney(enforcedPoolMyr - legacyPoolMyr);

  const fuelPerKm =
    input.truck != null
      ? calcFuelCostPerKm(
          input.globalCosts.fuelPriceMyr,
          input.truck.fuelEfficiencyKmPerL
        )
      : null;
  const maintenancePerKm =
    legPlan.totalDistanceKm > 0
      ? roundMoney(legPlan.totalMaintenanceMyr / legPlan.totalDistanceKm)
      : null;

  const totalQty = input.dispatchLines.reduce(
    (sum, line) =>
      sum +
      vehicleAllocatableQuantity(
        line.marketCode,
        line.quantity,
        line.mcDeliveryMode
      ),
    0
  );

  const legacyShipperMap = new Map<string, ShipperVehicleCompare>();
  if (input.legacyShippers) {
    for (const row of input.legacyShippers) {
      legacyShipperMap.set(row.shipperId, {
        shipperId: row.shipperId,
        shipperName: row.shipperName,
        quantity: row.quantity,
        legacyVehicleMyr: row.allocatedCostMyr,
        enforcedVehicleMyr: 0,
        deltaMyr: 0,
      });
    }
  } else {
    const byShipper = new Map<string, { name: string; qty: number }>();
    for (const line of input.dispatchLines) {
      const qty = vehicleAllocatableQuantity(
        line.marketCode,
        line.quantity,
        line.mcDeliveryMode
      );
      if (qty <= 0) continue;
      const existing = byShipper.get(line.shipperId) ?? {
        name: line.shipperName,
        qty: 0,
      };
      existing.qty += qty;
      byShipper.set(line.shipperId, existing);
    }

    for (const [shipperId, meta] of Array.from(byShipper.entries())) {
      const legacyAlloc = legacyAllocateTripVehicleCosts({
        quantity: meta.qty,
        vehicleAllocationDenominator: totalQty,
        tripAllocated,
      });
      legacyShipperMap.set(shipperId, {
        shipperId,
        shipperName: meta.name,
        quantity: meta.qty,
        legacyVehicleMyr: legacyAlloc.allocatedCostMyr,
        enforcedVehicleMyr: 0,
        deltaMyr: 0,
      });
    }
  }

  const enforcedByShipper = sumByShipper(enforced.allocations);
  const shippers: ShipperVehicleCompare[] = [];
  for (const [shipperId, legacy] of Array.from(legacyShipperMap.entries())) {
    const enforcedMyr = roundMoney(enforcedByShipper.get(shipperId) ?? 0);
    shippers.push({
      ...legacy,
      enforcedVehicleMyr: enforcedMyr,
      deltaMyr: roundMoney(enforcedMyr - legacy.legacyVehicleMyr),
    });
  }

  const legacyMarketMap = new Map<string, MarketQuantityRow>();
  for (const line of input.dispatchLines) {
    const group = routeGroupForLineMarket(line.marketCode);
    const qty = vehicleAllocatableQuantity(
      line.marketCode,
      line.quantity,
      line.mcDeliveryMode
    );
    if (qty <= 0) continue;
    const row = legacyMarketMap.get(group) ?? {
      routeGroup: group,
      quantity: 0,
      legacyVariableMyr: 0,
      enforcedVariableMyr: 0,
    };
    row.quantity += qty;
    row.legacyVariableMyr = roundMoney(
      row.legacyVariableMyr +
        allocateShare(qty, totalQty, legacyVariableMyr)
    );
    legacyMarketMap.set(group, row);
  }

  const enforcedMarketMap = sumVariableByRouteGroup(enforced.allocations);
  const markets: MarketQuantityRow[] = [];
  const allGroups = new Set([
    ...Array.from(legacyMarketMap.keys()),
    ...Array.from(enforcedMarketMap.keys()),
  ]);
  for (const group of Array.from(allGroups)) {
    const legacy = legacyMarketMap.get(group);
    const enf = enforcedMarketMap.get(group);
    markets.push({
      routeGroup: group,
      quantity: legacy?.quantity ?? enf?.qty ?? 0,
      legacyVariableMyr: legacy?.legacyVariableMyr ?? 0,
      enforcedVariableMyr: roundMoney(enf?.variable ?? 0),
    });
  }

  return {
    legacyPoolMyr,
    enforcedPoolMyr,
    conservationOk: Math.abs(conservationDeltaMyr) <= 0.01,
    conservationDeltaMyr,
    legacy: {
      fuelMyr: tripAllocated.fuelMyr,
      maintenanceMyr: tripAllocated.maintenanceMyr,
      tollMyr: tripAllocated.tollMyr,
      globalMyr: legacyGlobalMyr,
      totalMyr: legacyPoolMyr,
    },
    enforced: {
      fuelMyr: enforced.totals.fuelMyr,
      maintenanceMyr: enforced.totals.maintenanceMyr,
      tollMyr: enforced.totals.tollMyr,
      globalMyr: enforcedGlobalMyr,
      totalMyr: enforcedPoolMyr,
    },
    shippers: shippers.sort((a, b) => b.legacyVehicleMyr - a.legacyVehicleMyr),
    markets: markets.sort((a, b) => a.routeGroup.localeCompare(b.routeGroup)),
    legPlan,
    legDetails: buildLegDetails(legPlan, costLines),
    fuelPerKmMyr: fuelPerKm,
    maintenancePerKmMyr: maintenancePerKm,
    mileageNote:
      "sadoo_mileage_km 为双程(来回)里程；油费单价=fuelPrice÷efficiency 为每实际行驶km；段里程增量之和=最远市场双程里程",
  };
}

export function compareVoucherGateShadow(
  input: CompareTripShadowInput
): VoucherGateShadowCompare {
  const legacyLoadUnloadMyr = resolveTripLoadUnloadCost({
    unloadingRows: input.unloadingRows,
    loadingRows: input.loadingRows,
    dispatchEstimate: input.dispatchEstimate,
    ratesByMarket: input.ratesByMarket,
  });

  const enforced = resolveVoucherTripCosts({
    voucher: input.voucher ?? null,
    routeEstimate: input.routeEstimates,
    unloadingRows: input.unloadingRows,
    loadingRows: input.loadingRows,
  });

  const deltaMyr = roundMoney(enforced.loadUnloadMyr - legacyLoadUnloadMyr);

  return {
    voucherStatus: input.voucher?.status ?? null,
    costAppliedAt: input.voucher?.costAppliedAt?.toISOString() ?? null,
    legacyLoadUnloadMyr,
    enforcedLoadUnloadMyr: enforced.loadUnloadMyr,
    deltaMyr,
    gateWouldChange: Math.abs(deltaMyr) > 0.01,
  };
}

export function buildVehicleShadowDiffs(
  tripId: string,
  compare: TripVehicleShadowCompare
): Array<{
  tripId: string;
  scope: "vehicle";
  field: string;
  legacyMyr: number;
  nextMyr: number;
  deltaMyr: number;
}> {
  const fields = [
    ["fuelMyr", compare.legacy.fuelMyr, compare.enforced.fuelMyr],
    ["maintenanceMyr", compare.legacy.maintenanceMyr, compare.enforced.maintenanceMyr],
    ["tollMyr", compare.legacy.tollMyr, compare.enforced.tollMyr],
    ["globalMyr", compare.legacy.globalMyr, compare.enforced.globalMyr],
    ["totalMyr", compare.legacy.totalMyr, compare.enforced.totalMyr],
  ] as const;

  return fields
    .filter(([, legacy, next]) => Math.abs(legacy - next) > 0.001)
    .map(([field, legacyMyr, nextMyr]) => ({
      tripId,
      scope: "vehicle" as const,
      field,
      legacyMyr,
      nextMyr,
      deltaMyr: roundMoney(nextMyr - legacyMyr),
    }));
}
