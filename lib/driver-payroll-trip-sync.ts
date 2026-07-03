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
  buildCrateReturnImportContext,
  calculateTripAllowance,
  countPayrollMarketGroups,
  crateReturnCommissionForTrip,
  crateReturnMultiMarketAllowanceForTrip,
  getCrateReturnPlateDayInfo,
  type CrateReturnCommissionRates,
  type CrateReturnCommissionTripRef,
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

const charterIncludeForPayrollTrip = {
  truck: { select: { plate: true, type: true } },
} as const;

type DispatchForPayrollTrip = NonNullable<
  Awaited<ReturnType<typeof loadDispatchForPayrollTripSync>>
>;

export type SyncDriverPayrollTripResult = {
  action: "upserted" | "skipped" | "unchanged";
  dispatchOrderId?: string;
  charterTripId?: string;
  tripId?: string;
  tripAllowance?: number;
  crateReturnCommission?: number;
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

export type CancelledDispatchPayrollOrphan = {
  tripId: string;
  dispatchOrderId: string;
  dispatchNo: string | null;
  payrollDriverName: string;
  dispatchDriverName: string | null;
  date: Date;
  plate: string | null;
  tripAllowance: number;
  extraAllowance: number;
  crateReturnCommission: number;
};

export type CancelledDispatchOrphanScanResult = {
  /** Auto-delete: cancelled dispatch, tripAllowance=0, extraAllowance=0 (commission-only stale ok). */
  deletable: CancelledDispatchPayrollOrphan[];
  /** extraAllowance > 0 — never auto-delete. */
  protectedManual: CancelledDispatchPayrollOrphan[];
  /** tripAllowance > 0 on cancelled dispatch — keep for human review, never auto-delete. */
  needsManualReview: CancelledDispatchPayrollOrphan[];
};

/** Cancelled-dispatch orphans safe to auto-delete (no allowance amounts left on row). */
export function isCancelledDispatchOrphanAutoDeletable(trip: {
  tripAllowance: unknown;
  extraAllowance: unknown;
}) {
  const tripAllowance = decimalToNumber(trip.tripAllowance) ?? 0;
  const extraAllowance = decimalToNumber(trip.extraAllowance) ?? 0;
  return tripAllowance === 0 && extraAllowance === 0;
}

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

async function loadCharterForPayrollTripSync(charterTripId: string) {
  return prisma.charterTrip.findUnique({
    where: { id: charterTripId },
    include: charterIncludeForPayrollTrip,
  });
}

async function loadCrateReturnImportContextForDate(date: Date) {
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
      market: { select: { code: true } },
    },
  });
  return buildCrateReturnImportContext(imports);
}

function crateReturnRatesFromContext(
  allowanceContext: Awaited<ReturnType<typeof loadPayrollAllowanceContext>>
): CrateReturnCommissionRates {
  return {
    bigTruckCrateCommission: allowanceContext.bigTruckCrateCommission,
    smallTruckCrateCommission: allowanceContext.smallTruckCrateCommission,
    bpCrateCommissionBigTruck: allowanceContext.bpCrateCommissionBigTruck,
    bpCrateCommissionSmallTruck: allowanceContext.bpCrateCommissionSmallTruck,
  };
}

/** One physical return (date+truck) → commission on first dispatch, else first charter. */
async function isCrateReturnCommissionRecipient(input: {
  date: Date;
  truckId: string;
  tripRef: CrateReturnCommissionTripRef;
}) {
  const firstDispatch = await prisma.dispatchOrder.findFirst({
    where: {
      date: input.date,
      truckId: input.truckId,
      status: { notIn: ["cancelled", "draft"] },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (firstDispatch) {
    return (
      input.tripRef.source === "dispatch" &&
      input.tripRef.dispatchOrderId === firstDispatch.id
    );
  }

  const firstCharter = await prisma.charterTrip.findFirst({
    where: { date: input.date, truckId: input.truckId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!firstCharter) return false;
  return (
    input.tripRef.source === "charter" &&
    input.tripRef.charterTripId === firstCharter.id
  );
}

async function computeCrateReturnPayrollAmounts(input: {
  date: Date;
  truckId: string;
  truckType: string;
  plate: string;
  tripRef: CrateReturnCommissionTripRef;
  allowanceContext: Awaited<ReturnType<typeof loadPayrollAllowanceContext>>;
  importContext: Awaited<ReturnType<typeof loadCrateReturnImportContextForDate>>;
}) {
  const plateDay = getCrateReturnPlateDayInfo(
    input.importContext,
    input.date,
    input.plate
  );
  const isCommissionRecipient = await isCrateReturnCommissionRecipient({
    date: input.date,
    truckId: input.truckId,
    tripRef: input.tripRef,
  });

  return {
    crateReturnCommission: crateReturnCommissionForTrip({
      truckType: input.truckType,
      isCommissionRecipient,
      plateDay,
      rates: crateReturnRatesFromContext(input.allowanceContext),
    }),
    crateReturnMultiMarketAllowance: crateReturnMultiMarketAllowanceForTrip({
      isCommissionRecipient,
      plateDay,
      allowanceRate: input.allowanceContext.crateReturnMultiMarketAllowance,
    }),
  };
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

async function computeAutoTripAllowance(
  order: DispatchForPayrollTrip,
  allowanceContext: Awaited<ReturnType<typeof loadPayrollAllowanceContext>>,
  importContext: Awaited<ReturnType<typeof loadCrateReturnImportContextForDate>>
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
  const crateReturnAmounts = await computeCrateReturnPayrollAmounts({
    date: order.date,
    truckId: order.truckId,
    truckType: order.truck.type,
    plate: order.truck.plate,
    tripRef: { source: "dispatch", dispatchOrderId: order.id },
    allowanceContext,
    importContext,
  });

  return {
    tripAllowance: allowanceResult.tripAllowance,
    allowanceMarkets,
    marketCount: countPayrollMarketGroups(
      allowanceMarkets,
      allowanceContext.routes
    ),
    routeLabel: getRouteLabel(allowanceMarkets),
    crateReturnCommission: crateReturnAmounts.crateReturnCommission,
    crateReturnMultiMarketAllowance:
      crateReturnAmounts.crateReturnMultiMarketAllowance,
  };
}

export function payrollTripHasManualOverrides(trip: {
  extraAllowance: unknown;
}) {
  return (decimalToNumber(trip.extraAllowance) ?? 0) > 0;
}

/**
 * Incremental route-allowance sync for one dispatch (upsert by dispatchOrderId).
 * Auto-writes tripAllowance and crateReturnCommission. Never overwrites extraAllowance.
 * crateReturnCommission is always system-recalculated (no manual UI field).
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
  const [payrollMonth, allowanceContext, importContext] = await Promise.all([
    ensurePayrollMonth(driver.id, yearMonth),
    loadPayrollAllowanceContext(),
    loadCrateReturnImportContextForDate(dispatch.date),
  ]);

  const computed = await computeAutoTripAllowance(
    dispatch,
    allowanceContext,
    importContext
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
    const commissionUnchanged =
      decimalToNumber(existing.crateReturnCommission) ===
        computed.crateReturnCommission &&
      decimalToNumber(existing.crateReturnMultiMarketAllowance) ===
        computed.crateReturnMultiMarketAllowance;

    if (tripAllowanceUnchanged && commissionUnchanged) {
      await prisma.driverPayrollTrip.update({
        where: { id: existing.id },
        data: sharedMetadata,
      });
      return {
        action: "unchanged",
        dispatchOrderId,
        tripId: existing.id,
        tripAllowance: computed.tripAllowance,
        crateReturnCommission: computed.crateReturnCommission,
      };
    }

    const updated = await prisma.driverPayrollTrip.update({
      where: { id: existing.id },
      data: {
        ...sharedMetadata,
        tripAllowance: computed.tripAllowance,
        crateReturnCommission: computed.crateReturnCommission,
        crateReturnMultiMarketAllowance:
          computed.crateReturnMultiMarketAllowance,
      },
    });

    return {
      action: "upserted",
      dispatchOrderId,
      tripId: updated.id,
      tripAllowance: computed.tripAllowance,
      crateReturnCommission: computed.crateReturnCommission,
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
      crateReturnMultiMarketAllowance: computed.crateReturnMultiMarketAllowance,
      ...sharedMetadata,
    },
  });

  return {
    action: "upserted",
    dispatchOrderId,
    tripId: created.id,
    tripAllowance: computed.tripAllowance,
    crateReturnCommission: computed.crateReturnCommission,
  };
}

/**
 * Charter payroll row: tripAllowance stays 0; charterSalary from charterDriverSalaryMyr;
 * crate-return commission only. P&L/ops read payroll charterSalary (Step 2+3).
 */
export async function syncDriverPayrollTripForCharter(
  charterTripId: string
): Promise<SyncDriverPayrollTripResult> {
  const charter = await loadCharterForPayrollTripSync(charterTripId);
  if (!charter) {
    return { action: "skipped", charterTripId, reason: "charter_not_found" };
  }

  const driver = await resolveDriverForDispatch(charter.driverName);
  if (!driver) {
    return {
      action: "skipped",
      charterTripId,
      reason: "driver_unmatched",
    };
  }

  const charterSalary = decimalToNumber(charter.charterDriverSalaryMyr) ?? 0;

  const yearMonth = yearMonthFromDate(charter.date);
  const [payrollMonth, allowanceContext, importContext] = await Promise.all([
    ensurePayrollMonth(driver.id, yearMonth),
    loadPayrollAllowanceContext(),
    loadCrateReturnImportContextForDate(charter.date),
  ]);

  const crateReturnAmounts = await computeCrateReturnPayrollAmounts({
    date: charter.date,
    truckId: charter.truckId,
    truckType: charter.truck.type,
    plate: charter.truck.plate,
    tripRef: { source: "charter", charterTripId: charter.id },
    allowanceContext,
    importContext,
  });

  const sharedMetadata = {
    payrollMonthId: payrollMonth.id,
    date: charter.date,
    route: "包车 Charter",
    markets: [] as string[],
    marketCount: 0,
    truckType: charter.truck.type,
    notes: charter.truck.plate,
    tripAllowance: 0,
    charterSalary,
  };

  const existing = await prisma.driverPayrollTrip.findUnique({
    where: { charterTripId },
  });

  if (existing) {
    const commissionUnchanged =
      decimalToNumber(existing.crateReturnCommission) ===
        crateReturnAmounts.crateReturnCommission &&
      decimalToNumber(existing.crateReturnMultiMarketAllowance) ===
        crateReturnAmounts.crateReturnMultiMarketAllowance;
    const charterSalaryUnchanged =
      decimalToNumber(existing.charterSalary) === charterSalary;

    if (commissionUnchanged && charterSalaryUnchanged) {
      await prisma.driverPayrollTrip.update({
        where: { id: existing.id },
        data: sharedMetadata,
      });
      return {
        action: "unchanged",
        charterTripId,
        tripId: existing.id,
        tripAllowance: 0,
        crateReturnCommission: crateReturnAmounts.crateReturnCommission,
      };
    }

    const updated = await prisma.driverPayrollTrip.update({
      where: { id: existing.id },
      data: {
        ...sharedMetadata,
        crateReturnCommission: crateReturnAmounts.crateReturnCommission,
        crateReturnMultiMarketAllowance:
          crateReturnAmounts.crateReturnMultiMarketAllowance,
      },
    });

    return {
      action: "upserted",
      charterTripId,
      tripId: updated.id,
      tripAllowance: 0,
      crateReturnCommission: crateReturnAmounts.crateReturnCommission,
    };
  }

  const tripCount = await prisma.driverPayrollTrip.count({
    where: { payrollMonthId: payrollMonth.id },
  });

  const created = await prisma.driverPayrollTrip.create({
    data: {
      charterTripId,
      sortOrder: tripCount,
      extraAllowance: 0,
      crateReturnCommission: crateReturnAmounts.crateReturnCommission,
      crateReturnMultiMarketAllowance:
        crateReturnAmounts.crateReturnMultiMarketAllowance,
      ...sharedMetadata,
    },
  });

  return {
    action: "upserted",
    charterTripId,
    tripId: created.id,
    tripAllowance: 0,
    crateReturnCommission: crateReturnAmounts.crateReturnCommission,
  };
}

/** Re-sync payroll trips after crate import save/delete for affected plates in the import month. */
export async function syncPayrollTripsAfterCrateImportChange(
  date: Date,
  plates: string[]
) {
  const normalizedPlates = Array.from(
    new Set(plates.map((plate) => plate.trim()).filter(Boolean))
  );
  if (normalizedPlates.length === 0) return;

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month + 1, 0));

  const [dispatches, charters] = await Promise.all([
    prisma.dispatchOrder.findMany({
      where: {
        date: { gte: monthStart, lte: monthEnd },
        status: { notIn: ["cancelled", "draft"] },
        truck: { plate: { in: normalizedPlates } },
      },
      select: { id: true },
    }),
    prisma.charterTrip.findMany({
      where: {
        date: { gte: monthStart, lte: monthEnd },
        truck: { plate: { in: normalizedPlates } },
      },
      select: { id: true },
    }),
  ]);

  for (const order of dispatches) {
    await syncDriverPayrollTripForDispatch(order.id);
  }
  for (const trip of charters) {
    await syncDriverPayrollTripForCharter(trip.id);
  }
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

function mapCancelledDispatchOrphanRow(trip: {
  id: string;
  dispatchOrderId: string | null;
  date: Date;
  notes: string | null;
  tripAllowance: unknown;
  extraAllowance: unknown;
  crateReturnCommission: unknown;
  dispatchOrder: {
    dispatchNo: string | null;
    driverName: string | null;
  } | null;
  payrollMonth: { driver: { name: string } };
}): CancelledDispatchPayrollOrphan {
  return {
    tripId: trip.id,
    dispatchOrderId: trip.dispatchOrderId!,
    dispatchNo: trip.dispatchOrder?.dispatchNo ?? null,
    payrollDriverName: trip.payrollMonth.driver.name,
    dispatchDriverName: trip.dispatchOrder?.driverName ?? null,
    date: trip.date,
    plate: trip.notes,
    tripAllowance: decimalToNumber(trip.tripAllowance) ?? 0,
    extraAllowance: decimalToNumber(trip.extraAllowance) ?? 0,
    crateReturnCommission: decimalToNumber(trip.crateReturnCommission) ?? 0,
  };
}

/** Read-only: payroll rows still linked to cancelled dispatches. */
export async function findCancelledDispatchPayrollOrphans(input?: {
  payrollMonthId?: string;
  dateStart?: Date;
  dateEnd?: Date;
}): Promise<CancelledDispatchOrphanScanResult> {
  const trips = await prisma.driverPayrollTrip.findMany({
    where: {
      dispatchOrderId: { not: null },
      ...(input?.payrollMonthId ? { payrollMonthId: input.payrollMonthId } : {}),
      ...(input?.dateStart && input?.dateEnd
        ? { date: { gte: input.dateStart, lte: input.dateEnd } }
        : {}),
      dispatchOrder: { status: "cancelled" },
    },
    include: {
      dispatchOrder: {
        select: { dispatchNo: true, driverName: true },
      },
      payrollMonth: { include: { driver: { select: { name: true } } } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  const deletable: CancelledDispatchPayrollOrphan[] = [];
  const protectedManual: CancelledDispatchPayrollOrphan[] = [];
  const needsManualReview: CancelledDispatchPayrollOrphan[] = [];

  for (const trip of trips) {
    if (!trip.dispatchOrderId || !trip.dispatchOrder) continue;
    const row = mapCancelledDispatchOrphanRow(trip);
    if (payrollTripHasManualOverrides(trip)) {
      protectedManual.push(row);
    } else if (!isCancelledDispatchOrphanAutoDeletable(trip)) {
      needsManualReview.push(row);
    } else {
      deletable.push(row);
    }
  }

  return { deletable, protectedManual, needsManualReview };
}

/** Delete payroll orphans for cancelled dispatches (only zero-allowance rows; skips manual/review). */
export async function cleanupCancelledDispatchPayrollOrphans(input?: {
  payrollMonthId?: string;
  dateStart?: Date;
  dateEnd?: Date;
}): Promise<CancelledDispatchOrphanScanResult> {
  const scan = await findCancelledDispatchPayrollOrphans(input);
  if (scan.deletable.length === 0) return scan;

  await prisma.driverPayrollTrip.deleteMany({
    where: { id: { in: scan.deletable.map((row) => row.tripId) } },
  });

  return scan;
}

/**
 * Cancel hook: delete/zero payroll row, then re-sync crate-return winners for date+plate.
 */
export async function finalizeDispatchCancelPayroll(input: {
  dispatchOrderId: string;
  date: Date;
  plate: string;
}): Promise<HandleDriverPayrollTripCancelResult> {
  const result = await handleDriverPayrollTripOnDispatchCancel(
    input.dispatchOrderId
  );
  await syncPayrollTripsAfterCrateImportChange(input.date, [input.plate]);
  return result;
}
