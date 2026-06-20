import { prisma } from "@/lib/prisma";
import { loadPayrollAllowanceContext } from "@/app/actions/allowance-settings";
import { getRouteLabel } from "@/lib/payroll-route-label";
import { marketsForTripAllowance } from "@/lib/mc-dispatch-delivery";
import { decimalToNumber } from "@/lib/freight-rates";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import {
  dispatchMatchesDriver,
  normalizePayrollDriverName,
} from "@/lib/payroll-driver-match";
import {
  buildCrateReturnImportLookup,
  calculateTripAllowance,
  countPayrollMarketGroups,
  crateReturnCommissionForDispatch,
  dispatchHasCrateReturn,
} from "@/lib/trip-allowance";

const dispatchIncludeForPayrollTrip = {
  truck: { select: { plate: true, type: true } },
  lines: {
    include: {
      inboundLine: {
        select: {
          mcDeliveryMode: true,
          stall: { select: { market: { select: { code: true } } } },
        },
      },
    },
  },
} as const;

type DispatchForPayrollTrip = NonNullable<
  Awaited<ReturnType<typeof loadDispatchForPayrollTripSync>>
>;

export type SyncDriverPayrollTripResult = {
  action: "upserted" | "skipped" | "unchanged";
  dispatchOrderId: string;
  tripId?: string;
  tripAllowance?: number;
  reason?: string;
};

export type HandleDriverPayrollTripCancelResult = {
  dispatchOrderId: string;
  deleted: boolean;
  keptForManualOverrides: boolean;
  zeroedTripAllowance: boolean;
  manualExtraAllowance?: number;
  manualCrateReturnCommission?: number;
};

function yearMonthFromDate(date: Date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

async function loadDispatchForPayrollTripSync(dispatchOrderId: string) {
  return prisma.dispatchOrder.findUnique({
    where: { id: dispatchOrderId },
    include: dispatchIncludeForPayrollTrip,
  });
}

async function loadCrateReturnLookupForDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const { start, end } = getMonthDateRange(year, month);
  const imports = await prisma.tongImport.findMany({
    where: {
      date: { gte: start, lte: end },
      quantity: { gt: 0 },
    },
    select: {
      date: true,
      quantity: true,
      truck: { select: { plate: true } },
    },
  });
  return buildCrateReturnImportLookup(imports);
}

async function resolveDriverForDispatch(driverName: string | null) {
  if (!driverName?.trim()) return null;

  const drivers = await prisma.driver.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      fullName: true,
      nickname: true,
    },
  });

  const matched = drivers.filter((driver) =>
    dispatchMatchesDriver(driver, { driverName })
  );
  if (matched.length === 1) return matched[0];

  if (matched.length > 1) {
    const orderKey = normalizePayrollDriverName(driverName);
    return (
      matched.find(
        (driver) => normalizePayrollDriverName(driver.name) === orderKey
      ) ?? null
    );
  }

  return null;
}

async function ensurePayrollMonth(driverId: string, yearMonth: string) {
  return prisma.driverPayrollMonth.upsert({
    where: { driverId_yearMonth: { driverId, yearMonth } },
    create: { driverId, yearMonth },
    update: {},
  });
}

function computeAutoTripAllowance(
  order: DispatchForPayrollTrip,
  allowanceContext: Awaited<ReturnType<typeof loadPayrollAllowanceContext>>,
  importLookup: Set<string>
) {
  const assignedLines = (order.lines ?? []).map((row) => ({
    marketCode: row.inboundLine.stall.market?.code ?? null,
    mcDeliveryMode: row.inboundLine.mcDeliveryMode,
  }));
  const allowanceMarkets = marketsForTripAllowance(order.markets, assignedLines);
  const allowanceResult = calculateTripAllowance({
    markets: allowanceMarkets,
    routes: allowanceContext.routes,
    extraMarketAllowance: allowanceContext.extraMarketAllowance,
  });
  const crateReturnCommission = crateReturnCommissionForDispatch({
    truckType: order.truck.type,
    hasCrateReturn: dispatchHasCrateReturn(order, importLookup),
    rates: {
      bigTruckCrateCommission: allowanceContext.bigTruckCrateCommission,
      smallTruckCrateCommission: allowanceContext.smallTruckCrateCommission,
    },
  });

  return {
    tripAllowance: allowanceResult.tripAllowance,
    allowanceMarkets,
    marketCount: countPayrollMarketGroups(
      allowanceMarkets,
      allowanceContext.routes
    ),
    routeLabel: getRouteLabel(allowanceMarkets),
    crateReturnCommission,
  };
}

export function payrollTripHasManualOverrides(trip: {
  extraAllowance: unknown;
}) {
  return (decimalToNumber(trip.extraAllowance) ?? 0) > 0;
}

/**
 * Incremental route-allowance sync for one dispatch (upsert by dispatchOrderId).
 * Only auto-writes tripAllowance (+ descriptive metadata). Never overwrites
 * extraAllowance or crateReturnCommission on existing rows.
 */
export async function syncDriverPayrollTripForDispatch(
  dispatchOrderId: string
): Promise<SyncDriverPayrollTripResult> {
  const dispatch = await loadDispatchForPayrollTripSync(dispatchOrderId);
  if (!dispatch) {
    return { action: "skipped", dispatchOrderId, reason: "dispatch_not_found" };
  }

  if (dispatch.status === "cancelled") {
    return { action: "skipped", dispatchOrderId, reason: "cancelled" };
  }

  if (dispatch.status === "draft") {
    return { action: "skipped", dispatchOrderId, reason: "draft" };
  }

  const driver = await resolveDriverForDispatch(dispatch.driverName);
  if (!driver) {
    return {
      action: "skipped",
      dispatchOrderId,
      reason: "driver_unmatched",
    };
  }

  const yearMonth = yearMonthFromDate(dispatch.date);
  const [payrollMonth, allowanceContext, importLookup] = await Promise.all([
    ensurePayrollMonth(driver.id, yearMonth),
    loadPayrollAllowanceContext(),
    loadCrateReturnLookupForDate(dispatch.date),
  ]);

  const computed = computeAutoTripAllowance(
    dispatch,
    allowanceContext,
    importLookup
  );

  const existing = await prisma.driverPayrollTrip.findUnique({
    where: { dispatchOrderId },
  });

  const sharedMetadata = {
    payrollMonthId: payrollMonth.id,
    date: dispatch.date,
    route: computed.routeLabel,
    markets: dispatch.markets,
    marketCount: computed.marketCount,
    truckType: dispatch.truck.type,
    notes: dispatch.truck.plate,
  };

  if (existing) {
    const tripAllowanceUnchanged =
      decimalToNumber(existing.tripAllowance) === computed.tripAllowance;
    if (tripAllowanceUnchanged) {
      await prisma.driverPayrollTrip.update({
        where: { id: existing.id },
        data: sharedMetadata,
      });
      return {
        action: "unchanged",
        dispatchOrderId,
        tripId: existing.id,
        tripAllowance: computed.tripAllowance,
      };
    }

    const updated = await prisma.driverPayrollTrip.update({
      where: { id: existing.id },
      data: {
        ...sharedMetadata,
        tripAllowance: computed.tripAllowance,
      },
    });

    return {
      action: "upserted",
      dispatchOrderId,
      tripId: updated.id,
      tripAllowance: computed.tripAllowance,
    };
  }

  const tripCount = await prisma.driverPayrollTrip.count({
    where: { payrollMonthId: payrollMonth.id },
  });

  const created = await prisma.driverPayrollTrip.create({
    data: {
      dispatchOrderId,
      sortOrder: tripCount,
      tripAllowance: computed.tripAllowance,
      extraAllowance: 0,
      crateReturnCommission: computed.crateReturnCommission,
      ...sharedMetadata,
    },
  });

  return {
    action: "upserted",
    dispatchOrderId,
    tripId: created.id,
    tripAllowance: computed.tripAllowance,
  };
}

/**
 * On dispatch cancel: remove auto route allowance. Delete the payroll trip row
 * when there are no manual overrides; otherwise zero tripAllowance only.
 */
export async function handleDriverPayrollTripOnDispatchCancel(
  dispatchOrderId: string
): Promise<HandleDriverPayrollTripCancelResult> {
  const trip = await prisma.driverPayrollTrip.findUnique({
    where: { dispatchOrderId },
  });

  if (!trip) {
    return {
      dispatchOrderId,
      deleted: false,
      keptForManualOverrides: false,
      zeroedTripAllowance: false,
    };
  }

  const extra = decimalToNumber(trip.extraAllowance) ?? 0;
  const crateReturn = decimalToNumber(trip.crateReturnCommission) ?? 0;
  const hasManual = payrollTripHasManualOverrides(trip);

  if (hasManual) {
    await prisma.driverPayrollTrip.update({
      where: { id: trip.id },
      data: { tripAllowance: 0 },
    });
    return {
      dispatchOrderId,
      deleted: false,
      keptForManualOverrides: true,
      zeroedTripAllowance: true,
      manualExtraAllowance: extra,
      manualCrateReturnCommission: crateReturn,
    };
  }

  await prisma.driverPayrollTrip.delete({ where: { id: trip.id } });
  return {
    dispatchOrderId,
    deleted: true,
    keptForManualOverrides: false,
    zeroedTripAllowance: false,
  };
}
