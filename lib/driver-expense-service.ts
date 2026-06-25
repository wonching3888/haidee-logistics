import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/date-utils";
import {
  appendVoucherFieldChangeLogs,
  diffVoucherFieldChanges,
} from "@/lib/driver-voucher-audit";
import {
  applyVoucherStatusTransitionInTx,
  assertActorCanTransition,
  isVoucherStatus,
  type VoucherTransitionActor,
} from "@/lib/driver-voucher-status";
import type { VoucherStatus } from "@/lib/driver-voucher-status-types";
import { calendarDateUTC } from "@/lib/reports/period-report-shared";
import { formatTripRouteLabel, normalizeTripMarkets } from "@/lib/trip-allowance";
import {
  DEFAULT_CRATE_LOADING_RATES,
  calculateTripCrateLoadingFees,
  type CrateLoadingRateConfigInput,
} from "@/lib/crate-loading-calculator";
import {
  LARGE_CRATE_CODES,
  resolveTruckSize,
  truckSizeLabel,
} from "@/lib/driver-expense/constants";
import {
  bmPindahTripUnloadFee,
  calculateTripUnloadingFees,
  effectiveKpbFee,
  effectiveUnloadFee,
  lineSubtotal,
  type UnloadingMarketLineInput,
  type UnloadingRateConfigInput,
} from "@/lib/unloading-calculator";
import { decimalToNumber } from "@/lib/freight-rates";
import { MC_MARKET_CODE } from "@/lib/inbound-freight";
import {
  effectiveMarketsForTripCost,
  mcAssignedLinesFromDispatchLines,
  tripMcAllThirdParty,
} from "@/lib/mc-dispatch-delivery";
import {
  computeTripRouteCosts,
  findApplicableRoutes,
  loadGlobalTripCostValues,
  type RouteMasterCostRow,
} from "@/lib/operations-cost";

export const DEFAULT_UNLOADING_RATES: UnloadingRateConfigInput[] = [
  {
    market: "KL",
    smallCrate: 0.7,
    largeCrate: 0.9,
    box: 0.7,
    kpbSmall: 0.6,
    kpbLarge: 0.6,
    kpbBox: 0.3,
    unloadMode: "per_crate",
    kpbMode: "per_crate",
  },
  {
    market: "MC",
    smallCrate: 1.0,
    largeCrate: 1.0,
    box: 1.0,
    kpbSmall: 0.5,
    kpbLarge: 0.5,
    kpbBox: 0.5,
    unloadMode: "per_crate",
    kpbMode: "per_crate",
  },
  {
    market: "A",
    smallCrate: 1.5,
    largeCrate: 1.5,
    box: 1.0,
    kpbSmall: 0.3,
    kpbLarge: 0.3,
    kpbBox: 0.2,
    unloadMode: "per_crate",
    kpbMode: "per_crate",
  },
  {
    market: "BM",
    smallCrate: 1.0,
    largeCrate: 1.0,
    box: 0.6,
    kpbSmall: 7.0,
    kpbLarge: 20.0,
    kpbBox: 0,
    unloadMode: "per_crate",
    kpbMode: "per_trip",
  },
  {
    market: "KD",
    smallCrate: 1.0,
    largeCrate: 1.0,
    box: 1.0,
    kpbSmall: 5.0,
    kpbLarge: 10.0,
    kpbBox: 0,
    unloadMode: "per_crate",
    kpbMode: "per_trip",
  },
  {
    market: "TP",
    smallCrate: 50,
    largeCrate: 80,
    box: 0,
    kpbSmall: 0,
    kpbLarge: 0,
    kpbBox: 0,
    unloadMode: "per_trip",
    kpbMode: "per_trip",
  },
  {
    market: "KT",
    smallCrate: 50,
    largeCrate: 80,
    box: 0,
    kpbSmall: 0,
    kpbLarge: 0,
    kpbBox: 0,
    unloadMode: "per_trip",
    kpbMode: "per_trip",
  },
  {
    market: "P",
    smallCrate: 50,
    largeCrate: 80,
    box: 0,
    kpbSmall: 0,
    kpbLarge: 0,
    kpbBox: 0,
    unloadMode: "per_trip",
    kpbMode: "per_trip",
  },
  {
    market: "SA",
    smallCrate: 50,
    largeCrate: 80,
    box: 0,
    kpbSmall: 0,
    kpbLarge: 0,
    kpbBox: 0,
    unloadMode: "per_trip",
    kpbMode: "per_trip",
  },
  {
    market: "NT",
    smallCrate: 50,
    largeCrate: 80,
    box: 0,
    kpbSmall: 0,
    kpbLarge: 0,
    kpbBox: 0,
    unloadMode: "per_trip",
    kpbMode: "per_trip",
  },
  {
    market: "JB",
    smallCrate: 0,
    largeCrate: 0,
    box: 0,
    kpbSmall: 0,
    kpbLarge: 0,
    kpbBox: 0,
    unloadMode: "per_crate",
    kpbMode: "per_crate",
  },
];

function parseDateInput(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return calendarDateUTC(y, m, d);
}

function classifyCrate(tongCode: string, isBox: boolean) {
  if (isBox || tongCode.toUpperCase() === "BOX") {
    return "box" as const;
  }
  if (LARGE_CRATE_CODES.has(tongCode.toUpperCase())) {
    return "large" as const;
  }
  return "small" as const;
}

export async function ensureUnloadingRateConfigsSeeded() {
  for (const row of DEFAULT_UNLOADING_RATES) {
    await prisma.unloadingRateConfig.upsert({
      where: { market: row.market },
      create: row,
      update: {},
    });
  }
}

export async function ensureCrateLoadingRateConfigsSeeded() {
  for (const row of DEFAULT_CRATE_LOADING_RATES) {
    await prisma.crateLoadingRateConfig.upsert({
      where: { market: row.market },
      create: row,
      update: {},
    });
  }
}

export async function listUnloadingRateConfigs() {
  await ensureUnloadingRateConfigsSeeded();
  return prisma.unloadingRateConfig.findMany({
    orderBy: { market: "asc" },
  });
}

export async function upsertUnloadingRateConfig(
  input: UnloadingRateConfigInput
) {
  return prisma.unloadingRateConfig.upsert({
    where: { market: input.market },
    create: input,
    update: input,
  });
}

export async function listCrateLoadingRateConfigs() {
  await ensureCrateLoadingRateConfigsSeeded();
  return prisma.crateLoadingRateConfig.findMany({
    orderBy: { market: "asc" },
  });
}

export async function upsertCrateLoadingRateConfig(
  input: CrateLoadingRateConfigInput
) {
  return prisma.crateLoadingRateConfig.upsert({
    where: { market: input.market },
    create: input,
    update: input,
  });
}

async function loadUnloadingRatesMap() {
  const rows = await listUnloadingRateConfigs();
  return new Map(rows.map((row) => [row.market, row]));
}

async function loadCrateLoadingRatesMap() {
  const rows = await listCrateLoadingRateConfigs();
  return new Map(rows.map((row) => [row.market, row]));
}

function aggregateDispatchUnloadingLines(
  dispatch: Awaited<ReturnType<typeof loadDispatchForExpense>>
) {
  const assignedMcLines = dispatch.lines
    .filter(
      (dl) =>
        dl.inboundLine?.dispatchStatus === "assigned" &&
        dl.inboundLine.stall.market?.code === MC_MARKET_CODE
    )
    .map((dl) => ({
      marketCode: MC_MARKET_CODE,
      mcDeliveryMode: dl.inboundLine!.mcDeliveryMode,
    }));
  const skipMcUnloading = tripMcAllThirdParty(assignedMcLines);

  const byMarket = new Map<
    string,
    UnloadingMarketLineInput & { storeCode: string | null }
  >();

  for (const dl of dispatch.lines) {
    const line = dl.inboundLine;
    if (!line || line.dispatchStatus !== "assigned") continue;
    const market = line.stall.market?.code?.trim().toUpperCase();
    if (!market) continue;
    if (skipMcUnloading && market === MC_MARKET_CODE) continue;

    const qty = decimalToNumber(line.quantity) ?? 0;
    if (qty <= 0) continue;

    const tongCode = line.tongType?.code ?? "";
    const bucket = classifyCrate(tongCode, line.tongType?.isBox ?? false);
    const existing = byMarket.get(market) ?? {
      market,
      storeCode: line.stall.code ?? null,
      smallCrateQty: 0,
      largeCrateQty: 0,
      boxQty: 0,
    };

    if (bucket === "box") existing.boxQty += qty;
    else if (bucket === "large") existing.largeCrateQty += qty;
    else existing.smallCrateQty += qty;

    if (!existing.storeCode && line.stall.code) {
      existing.storeCode = line.stall.code;
    }

    byMarket.set(market, existing);
  }

  return Array.from(byMarket.values());
}

export type UnloadingDispatchEstimateInput = {
  truck: { type: string | null } | null;
  lines: Array<{
    inboundLine: {
      dispatchStatus: string;
      quantity: unknown;
      mcDeliveryMode?: string | null;
      stall: {
        code: string | null;
        market: { code: string } | null;
      };
      tongType: { code: string; isBox: boolean } | null;
    } | null;
  }>;
};

export async function getUnloadingRatesByMarket(): Promise<
  Map<string, UnloadingRateConfigInput>
> {
  const rows = await listUnloadingRateConfigs();
  return new Map(rows.map((row) => [row.market, row]));
}

export function estimateTripUnloadingFeesTotal(
  dispatch: UnloadingDispatchEstimateInput,
  ratesByMarket: Map<string, UnloadingRateConfigInput>
): number {
  const truckSize = resolveTruckSize(dispatch.truck?.type);
  const marketLines = aggregateDispatchUnloadingLines(
    dispatch as Awaited<ReturnType<typeof loadDispatchForExpense>>
  );
  const calculated = calculateTripUnloadingFees({
    lines: marketLines,
    ratesByMarket,
    truckSize,
  });
  return roundMoney(
    calculated.reduce(
      (sum, row) =>
        sum +
        effectiveUnloadFee({
          unloadFee: row.unloadFee,
          unloadFeeOverride: null,
        }) +
        effectiveKpbFee({
          kpbFee: row.kpbFee,
          kpbFeeOverride: null,
          isKpbExempt: row.isKpbExempt,
        }),
      0
    )
  );
}

async function loadDispatchForExpense(tripId: string) {
  const dispatch = await prisma.dispatchOrder.findUnique({
    where: { id: tripId },
    include: {
      truck: true,
      lines: {
        include: {
          inboundLine: {
            include: {
              stall: { include: { market: true } },
              tongType: true,
            },
          },
        },
      },
    },
  });
  if (!dispatch) throw new Error("趟次不存在 Trip not found");
  return dispatch;
}

function dispatchHasAssignedInboundLines(
  dispatch: Awaited<ReturnType<typeof loadDispatchForExpense>>
) {
  return dispatch.lines.some(
    (dl) =>
      dl.inboundLine?.dispatchStatus === "assigned" &&
      (decimalToNumber(dl.inboundLine.quantity) ?? 0) > 0
  );
}

function rowHasUnloadingActualOverride(row: {
  unloadFeeOverride: number | null;
  kpbFeeOverride: number | null;
}) {
  return row.unloadFeeOverride != null || row.kpbFeeOverride != null;
}

export type SyncUnloadingFeeEstimatesOptions = {
  /** When true, skip sync for cancelled dispatches (default true). */
  skipIfCancelled?: boolean;
};

export async function syncUnloadingFeeEstimatesForTrip(
  tripId: string,
  options?: SyncUnloadingFeeEstimatesOptions
) {
  const skipIfCancelled = options?.skipIfCancelled ?? true;
  const dispatch = await loadDispatchForExpense(tripId);

  if (skipIfCancelled && dispatch.status === "cancelled") {
    return prisma.unloadingFee.findMany({
      where: { tripId },
      orderBy: [{ tripDate: "desc" }, { route: "asc" }, { market: "asc" }],
    });
  }

  if (!dispatchHasAssignedInboundLines(dispatch)) {
    await prisma.unloadingFee.deleteMany({
      where: {
        tripId,
        unloadFeeOverride: null,
        kpbFeeOverride: null,
      },
    });
    return [];
  }

  const ratesByMarket = await loadUnloadingRatesMap();
  const truckSize = resolveTruckSize(dispatch.truck.type);
  const marketLines = aggregateDispatchUnloadingLines(dispatch);

  const calculated = calculateTripUnloadingFees({
    lines: marketLines,
    ratesByMarket,
    truckSize,
  });

  const route = formatTripRouteLabel(dispatch.markets);
  const lorry = dispatch.truck.plate;
  const driver = dispatch.driverName ?? "";
  const calculatedMarkets = new Set(calculated.map((row) => row.market));

  const existingRows = await prisma.unloadingFee.findMany({
    where: { tripId },
  });

  for (const row of calculated) {
    await prisma.unloadingFee.upsert({
      where: {
        tripId_market: { tripId, market: row.market },
      },
      create: {
        tripId,
        tripDate: dispatch.date,
        lorry,
        driver,
        route,
        market: row.market,
        storeCode: row.storeCode,
        smallCrateQty: row.smallCrateQty,
        largeCrateQty: row.largeCrateQty,
        boxQty: row.boxQty,
        unloadFee: row.unloadFee,
        kpbFee: row.kpbFee,
        isKpbExempt: row.isKpbExempt,
        tripLevelNote: row.tripLevelNote,
      },
      update: {
        tripDate: dispatch.date,
        lorry,
        driver,
        route,
        storeCode: row.storeCode,
        smallCrateQty: row.smallCrateQty,
        largeCrateQty: row.largeCrateQty,
        boxQty: row.boxQty,
        unloadFee: row.unloadFee,
        kpbFee: row.kpbFee,
        isKpbExempt: row.isKpbExempt,
        tripLevelNote: row.tripLevelNote,
      },
    });
  }

  for (const existing of existingRows) {
    if (calculatedMarkets.has(existing.market)) continue;
    if (rowHasUnloadingActualOverride(existing)) continue;
    await prisma.unloadingFee.delete({ where: { id: existing.id } });
  }

  return prisma.unloadingFee.findMany({
    where: { tripId },
    orderBy: [{ tripDate: "desc" }, { route: "asc" }, { market: "asc" }],
  });
}

/** @deprecated Use syncUnloadingFeeEstimatesForTrip — preserves override fields. */
export async function generateUnloadingFeesForTrip(tripId: string) {
  return syncUnloadingFeeEstimatesForTrip(tripId);
}

export async function tripHasVoucherUnloadingActuals(
  tripId: string
): Promise<boolean> {
  const voucher = await prisma.driverVoucher.findFirst({
    where: { tripId },
    select: { upahTurunActual: true, kpbActual: true },
  });
  if (!voucher) return false;
  return (
    voucher.upahTurunActual != null || voucher.kpbActual != null
  );
}

/** @deprecated Use tripHasVoucherUnloadingActuals for cancel policy. */
export async function tripHasRecordedUnloadingActuals(tripId: string) {
  return tripHasVoucherUnloadingActuals(tripId);
}

export async function handleUnloadingFeesOnDispatchCancel(tripId: string) {
  if (await tripHasVoucherUnloadingActuals(tripId)) {
    return { deleted: false, keptForActuals: true };
  }

  const result = await prisma.unloadingFee.deleteMany({ where: { tripId } });
  return { deleted: true, keptForActuals: false, count: result.count };
}

export async function generateCrateLoadingFeesForTrip(tripId: string) {
  const dispatch = await loadDispatchForExpense(tripId);
  const imports = await prisma.tongImport.findMany({
    where: { date: dispatch.date, truckId: dispatch.truckId },
    include: { market: { select: { code: true } } },
  });

  const markets = imports
    .map((row) => row.market.code)
    .filter((code): code is string => Boolean(code));

  if (markets.length === 0) return [];

  const ratesByMarket = await loadCrateLoadingRatesMap();
  const truckSize = resolveTruckSize(dispatch.truck.type);
  const calculated = calculateTripCrateLoadingFees({
    markets: markets.map((market) => ({ market })),
    ratesByMarket,
    truckSize,
  });

  const route = formatTripRouteLabel(dispatch.markets);
  const lorry = dispatch.truck.plate;
  const driver = dispatch.driverName ?? "";

  await prisma.crateLoadingFee.deleteMany({ where: { tripId } });

  return prisma.crateLoadingFee.createManyAndReturn({
    data: calculated.map((row) => ({
      tripId,
      tripDate: dispatch.date,
      lorry,
      driver,
      route,
      market: row.market,
      truckSize: truckSizeLabel(row.truckSize),
      loadingFee: row.loadingFee,
    })),
  });
}

export async function listUnloadingFees(filters: {
  tripId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const where: {
    tripId?: string;
    tripDate?: { gte?: Date; lte?: Date };
  } = {};

  if (filters.tripId) where.tripId = filters.tripId;
  if (!filters.tripId && !filters.startDate && !filters.endDate) {
    return [];
  }
  if (filters.startDate || filters.endDate) {
    where.tripDate = {};
    if (filters.startDate) where.tripDate.gte = parseDateInput(filters.startDate);
    if (filters.endDate) where.tripDate.lte = parseDateInput(filters.endDate);
  }

  return prisma.unloadingFee.findMany({
    where,
    orderBy: [{ tripDate: "desc" }, { route: "asc" }, { market: "asc" }],
  });
}

export async function listCrateLoadingFees(filters: {
  tripId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const where: {
    tripId?: string;
    tripDate?: { gte?: Date; lte?: Date };
  } = {};

  if (filters.tripId) where.tripId = filters.tripId;
  if (!filters.tripId && !filters.startDate && !filters.endDate) {
    return [];
  }
  if (filters.startDate || filters.endDate) {
    where.tripDate = {};
    if (filters.startDate) where.tripDate.gte = parseDateInput(filters.startDate);
    if (filters.endDate) where.tripDate.lte = parseDateInput(filters.endDate);
  }

  return prisma.crateLoadingFee.findMany({
    where,
    orderBy: [{ tripDate: "desc" }, { route: "asc" }, { market: "asc" }],
  });
}

export async function patchUnloadingFee(
  id: string,
  input: { unloadFeeOverride?: number | null; kpbFeeOverride?: number | null }
) {
  return prisma.unloadingFee.update({
    where: { id },
    data: {
      unloadFeeOverride: input.unloadFeeOverride,
      kpbFeeOverride: input.kpbFeeOverride,
    },
  });
}

export async function patchCrateLoadingFee(
  id: string,
  input: { loadingFeeOverride?: number | null }
) {
  return prisma.crateLoadingFee.update({
    where: { id },
    data: { loadingFeeOverride: input.loadingFeeOverride },
  });
}

export async function listDriverVouchers(filters: {
  tripId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  statusIn?: string;
  q?: string;
}) {
  const where: Prisma.DriverVoucherWhereInput = {};

  if (filters.tripId) where.tripId = filters.tripId;
  if (filters.statusIn) {
    const statuses = filters.statusIn
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length > 0) {
      where.status = { in: statuses };
    }
  } else if (filters.status) {
    where.status = filters.status;
  }
  if (filters.startDate || filters.endDate) {
    where.tripDate = {};
    if (filters.startDate) where.tripDate.gte = parseDateInput(filters.startDate);
    if (filters.endDate) where.tripDate.lte = parseDateInput(filters.endDate);
  }
  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { voucherNo: { contains: q, mode: "insensitive" } },
      { lorry: { contains: q, mode: "insensitive" } },
    ];
  }

  const hasScope =
    filters.tripId ||
    filters.startDate ||
    filters.endDate ||
    filters.status ||
    filters.statusIn ||
    Boolean(q);

  if (!hasScope) {
    return [];
  }

  return prisma.driverVoucher.findMany({
    where,
    orderBy: [{ tripDate: "desc" }, { voucherNo: "desc" }],
  });
}

export async function countPendingReviewVouchers(): Promise<number> {
  return prisma.driverVoucher.count({
    where: { status: "pending_review" },
  });
}

export async function getDriverVoucher(id: string) {
  return prisma.driverVoucher.findUnique({ where: { id } });
}

const EDITABLE_VOUCHER_STATUSES = new Set<VoucherStatus>([
  "draft",
  "clerk_entered",
  "rejected",
]);

export interface DriverVoucherWriteOptions {
  actor?: VoucherTransitionActor;
  submitEntry?: boolean;
}

type VoucherAmountPatch = Partial<{
  chopBorderAmt: number | null;
  chopBorderActual: number | null;
  parkingAmt: number | null;
  parkingActual: number | null;
  kpbAmt: number | null;
  kpbActual: number | null;
  fishCheckAmt: number | null;
  fishCheckActual: number | null;
  upahTurunAmt: number | null;
  upahTurunActual: number | null;
  upahNaikTongAmt: number | null;
  upahNaikTongActual: number | null;
  minyakMotoEnabled: boolean;
  minyakMotoAmt: number;
  minyakMotoActual: number | null;
  otherActual: number | null;
  duitJalan: number | null;
}>;

function assertVoucherEditable(status: string) {
  if (!isVoucherStatus(status) || !EDITABLE_VOUCHER_STATUSES.has(status)) {
    throw new Error(
      "当前状态不可编辑 / Voucher cannot be edited in this status"
    );
  }
}

export async function listDriverVoucherChangeLogs(voucherId: string) {
  const logs = await prisma.driverVoucherChangeLog.findMany({
    where: { voucherId },
    orderBy: { changedAt: "desc" },
  });

  const userIds = Array.from(
    new Set(logs.map((log) => log.changedBy).filter(Boolean) as string[])
  );
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
  const userNameById = new Map(users.map((user) => [user.id, user.name]));

  return logs.map((log) => ({
    id: log.id,
    eventType: log.eventType,
    field: log.field,
    oldValue: log.oldValue,
    newValue: log.newValue,
    changedBy: log.changedBy,
    changedByName: log.changedBy
      ? (userNameById.get(log.changedBy) ?? null)
      : null,
    changedAt: log.changedAt.toISOString(),
    reason: log.reason,
  }));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function sumActualBelanja(voucher: {
  chopBorderActual: number | null;
  parkingActual: number | null;
  kpbActual: number | null;
  fishCheckActual: number | null;
  upahTurunActual: number | null;
  upahNaikTongActual: number | null;
  minyakMotoEnabled: boolean;
  minyakMotoActual: number | null;
  otherActual?: number | null;
}) {
  let total = 0;
  const fields = [
    voucher.chopBorderActual,
    voucher.parkingActual,
    voucher.kpbActual,
    voucher.fishCheckActual,
    voucher.upahTurunActual,
    voucher.upahNaikTongActual,
    voucher.otherActual ?? null,
  ];
  for (const value of fields) {
    if (value != null) total += value;
  }
  if (voucher.minyakMotoEnabled && voucher.minyakMotoActual != null) {
    total += voucher.minyakMotoActual;
  }
  return roundMoney(total);
}

function allocateByProportion(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  if (weights.length === 1) return [roundMoney(total)];

  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const effectiveWeights = weightSum > 0 ? weights : weights.map(() => 1);
  const denominator = effectiveWeights.reduce((sum, weight) => sum + weight, 0);

  const shares: number[] = [];
  let allocated = 0;
  for (let index = 0; index < effectiveWeights.length; index++) {
    if (index === effectiveWeights.length - 1) {
      shares.push(roundMoney(total - allocated));
    } else {
      const share = roundMoney(
        total * (effectiveWeights[index] / denominator)
      );
      shares.push(share);
      allocated += share;
    }
  }
  return shares;
}

async function writebackVoucherActuals(voucher: {
  tripId: string;
  kpbActual: number | null;
  upahTurunActual: number | null;
  upahNaikTongActual: number | null;
}) {
  if (voucher.kpbActual != null) {
    const unloadingRows = await prisma.unloadingFee.findMany({
      where: { tripId: voucher.tripId },
      orderBy: { createdAt: "asc" },
    });
    if (unloadingRows.length === 1) {
      await prisma.unloadingFee.update({
        where: { id: unloadingRows[0].id },
        data: { kpbFeeOverride: voucher.kpbActual },
      });
    } else if (unloadingRows.length > 1) {
      const shares = allocateByProportion(
        voucher.kpbActual,
        unloadingRows.map((row) => row.kpbFee)
      );
      await Promise.all(
        unloadingRows.map((row, index) =>
          prisma.unloadingFee.update({
            where: { id: row.id },
            data: { kpbFeeOverride: shares[index] },
          })
        )
      );
    }
  }

  if (voucher.upahTurunActual != null) {
    const unloadingRows = await prisma.unloadingFee.findMany({
      where: { tripId: voucher.tripId },
      orderBy: { createdAt: "asc" },
    });
    if (unloadingRows.length === 1) {
      await prisma.unloadingFee.update({
        where: { id: unloadingRows[0].id },
        data: { unloadFeeOverride: voucher.upahTurunActual },
      });
    } else if (unloadingRows.length > 1) {
      const shares = allocateByProportion(
        voucher.upahTurunActual,
        unloadingRows.map((row) => row.unloadFee)
      );
      await Promise.all(
        unloadingRows.map((row, index) =>
          prisma.unloadingFee.update({
            where: { id: row.id },
            data: { unloadFeeOverride: shares[index] },
          })
        )
      );
    }
  }

  if (voucher.upahNaikTongActual != null) {
    const loadingRows = await prisma.crateLoadingFee.findMany({
      where: { tripId: voucher.tripId },
      orderBy: { createdAt: "asc" },
    });
    if (loadingRows.length === 1) {
      await prisma.crateLoadingFee.update({
        where: { id: loadingRows[0].id },
        data: { loadingFeeOverride: voucher.upahNaikTongActual },
      });
    } else if (loadingRows.length > 1) {
      const shares = allocateByProportion(
        voucher.upahNaikTongActual,
        loadingRows.map((row) => row.loadingFee)
      );
      await Promise.all(
        loadingRows.map((row, index) =>
          prisma.crateLoadingFee.update({
            where: { id: row.id },
            data: { loadingFeeOverride: shares[index] },
          })
        )
      );
    }
  }
}

export async function suggestVoucherAmounts(tripId: string) {
  const dispatch = await loadDispatchForExpense(tripId);
  const [unloadingFees, loadingFees, routes, globalCosts] = await Promise.all([
    listUnloadingFees({ tripId }),
    listCrateLoadingFees({ tripId }),
    prisma.routeMaster.findMany({ where: { active: true } }),
    loadGlobalTripCostValues(),
  ]);

  const upahTurunAmt = roundMoney(
    unloadingFees.reduce(
      (sum, row) =>
        sum +
        effectiveUnloadFee({
          unloadFee: row.unloadFee,
          unloadFeeOverride: row.unloadFeeOverride,
        }),
      0
    )
  );

  const kpbAmt = roundMoney(
    unloadingFees.reduce(
      (sum, row) =>
        sum +
        effectiveKpbFee({
          kpbFee: row.kpbFee,
          kpbFeeOverride: row.kpbFeeOverride,
          isKpbExempt: row.isKpbExempt,
        }),
      0
    )
  );

  const upahNaikTongAmt = roundMoney(
    loadingFees.reduce(
      (sum, row) => sum + (row.loadingFeeOverride ?? row.loadingFee),
      0
    )
  );

  const routeRows: RouteMasterCostRow[] = routes.map((route) => ({
    code: route.code,
    markets: route.markets,
    sadooMileageKm: decimalToNumber(route.sadooMileageKm),
    tollFee: decimalToNumber(route.tollFee),
    tollFeeClass2: decimalToNumber(route.tollFeeClass2),
    tollFeeClass3: decimalToNumber(route.tollFeeClass3),
    fishCheckingFee: decimalToNumber(route.fishCheckingFee),
    parkingFee: decimalToNumber(route.parkingFee),
  }));

  const mcAssignedLines = mcAssignedLinesFromDispatchLines(dispatch.lines);
  const effectiveMarkets = effectiveMarketsForTripCost(
    dispatch.markets,
    mcAssignedLines
  );
  const applicableRoutes = findApplicableRoutes(effectiveMarkets, routeRows);
  const routeCosts = computeTripRouteCosts(applicableRoutes, globalCosts);

  return {
    tripId,
    tripDate: toDateInputValue(dispatch.date),
    lorry: dispatch.truck.plate,
    driverName: dispatch.driverName ?? "",
    route: formatTripRouteLabel(dispatch.markets),
    chopBorderAmt: routeCosts.borderPass,
    parkingAmt: routeCosts.parkingFee,
    kpbAmt,
    fishCheckAmt: routeCosts.fishCheckingFee,
    upahTurunAmt,
    upahNaikTongAmt,
    totalQuantity: dispatch.lines.reduce((sum, dl) => {
      const qty = decimalToNumber(dl.inboundLine?.quantity) ?? 0;
      return sum + qty;
    }, 0),
  };
}

export async function nextVoucherNo(tripDateInput?: string) {
  const dateStr =
    tripDateInput ?? toDateInputValue(new Date());
  const prefix = `V-${dateStr.replace(/-/g, "")}-`;
  const latest = await prisma.driverVoucher.findFirst({
    where: { voucherNo: { startsWith: prefix } },
    orderBy: { voucherNo: "desc" },
  });

  let seq = 1;
  if (latest) {
    const tail = latest.voucherNo.slice(prefix.length);
    const parsed = Number(tail);
    if (Number.isFinite(parsed)) seq = parsed + 1;
  }

  return `${prefix}${String(seq).padStart(3, "0")}`;
}

export async function createDriverVoucher(
  input: {
    voucherNo?: string;
    tripId: string;
    chopBorderAmt?: number | null;
    chopBorderActual?: number | null;
    parkingAmt?: number | null;
    parkingActual?: number | null;
    kpbAmt?: number | null;
    kpbActual?: number | null;
    fishCheckAmt?: number | null;
    fishCheckActual?: number | null;
    upahTurunAmt?: number | null;
    upahTurunActual?: number | null;
    upahNaikTongAmt?: number | null;
    upahNaikTongActual?: number | null;
    minyakMotoEnabled?: boolean;
    minyakMotoAmt?: number;
    minyakMotoActual?: number | null;
    otherActual?: number | null;
    duitJalan?: number | null;
  },
  options?: DriverVoucherWriteOptions
) {
  const suggestion = await suggestVoucherAmounts(input.tripId);
  const voucherNo =
    input.voucherNo ?? (await nextVoucherNo(suggestion.tripDate));

  const draft = {
    voucherNo,
    tripId: input.tripId,
    tripDate: parseDateInput(suggestion.tripDate),
    lorry: suggestion.lorry,
    driverName: suggestion.driverName,
    route: suggestion.route,
    chopBorderAmt: input.chopBorderAmt ?? suggestion.chopBorderAmt,
    chopBorderActual: input.chopBorderActual ?? null,
    parkingAmt: input.parkingAmt ?? suggestion.parkingAmt,
    parkingActual: input.parkingActual ?? null,
    kpbAmt: input.kpbAmt ?? suggestion.kpbAmt,
    kpbActual: input.kpbActual ?? null,
    fishCheckAmt: input.fishCheckAmt ?? suggestion.fishCheckAmt,
    fishCheckActual: input.fishCheckActual ?? null,
    upahTurunAmt: input.upahTurunAmt ?? suggestion.upahTurunAmt,
    upahTurunActual: input.upahTurunActual ?? null,
    upahNaikTongAmt: input.upahNaikTongAmt ?? suggestion.upahNaikTongAmt,
    upahNaikTongActual: input.upahNaikTongActual ?? null,
    minyakMotoEnabled: input.minyakMotoEnabled ?? false,
    minyakMotoAmt: input.minyakMotoAmt ?? 8,
    minyakMotoActual: input.minyakMotoActual ?? null,
    otherActual: input.otherActual ?? null,
    duitJalan: input.duitJalan ?? null,
    belanja: null as number | null,
    baki: null as number | null,
  };

  draft.belanja = sumActualBelanja(draft);
  draft.baki =
    draft.duitJalan != null
      ? roundMoney(draft.duitJalan - draft.belanja)
      : null;

  const submitEntry = options?.submitEntry ?? true;
  const actor = options?.actor;

  const voucher = await prisma.$transaction(async (tx) => {
    const created = await tx.driverVoucher.create({ data: draft });

    if (submitEntry && actor) {
      assertActorCanTransition(actor, "clerk_entered");
      return applyVoucherStatusTransitionInTx(tx, {
        voucherId: created.id,
        fromStatus: "draft",
        toStatus: "clerk_entered",
        actor,
      });
    }

    return created;
  });

  await writebackVoucherActuals({
    tripId: voucher.tripId,
    kpbActual: voucher.kpbActual,
    upahTurunActual: voucher.upahTurunActual,
    upahNaikTongActual: voucher.upahNaikTongActual,
  });
  return voucher;
}

export async function updateDriverVoucher(
  id: string,
  input: VoucherAmountPatch,
  options?: DriverVoucherWriteOptions
) {
  const existing = await prisma.driverVoucher.findUnique({ where: { id } });
  if (!existing) throw new Error("Voucher not found");

  assertVoucherEditable(existing.status);

  const merged = { ...existing, ...input };
  const belanja = sumActualBelanja(merged);
  const baki =
    merged.duitJalan != null
      ? roundMoney(merged.duitJalan - belanja)
      : null;

  const actor = options?.actor;
  const submitEntry =
    options?.submitEntry ??
    (existing.status === "draft" || existing.status === "rejected");

  const fieldChanges = diffVoucherFieldChanges(existing, input);

  const voucher = await prisma.$transaction(async (tx) => {
    const updated = await tx.driverVoucher.update({
      where: { id },
      data: { ...input, belanja, baki },
    });

    if (actor && fieldChanges.length > 0) {
      await appendVoucherFieldChangeLogs(tx, {
        voucherId: id,
        changes: fieldChanges,
        changedBy: actor.id,
      });
    }

    if (
      submitEntry &&
      actor &&
      (existing.status === "draft" || existing.status === "rejected")
    ) {
      const fromStatus = existing.status as VoucherStatus;
      assertActorCanTransition(actor, "clerk_entered");
      return applyVoucherStatusTransitionInTx(tx, {
        voucherId: id,
        fromStatus,
        toStatus: "clerk_entered",
        actor,
      });
    }

    return updated;
  });

  await writebackVoucherActuals({
    tripId: voucher.tripId,
    kpbActual: voucher.kpbActual,
    upahTurunActual: voucher.upahTurunActual,
    upahNaikTongActual: voucher.upahNaikTongActual,
  });
  return voucher;
}

function parkingFeeForMarket(market: string, routes: RouteMasterCostRow[]): number {
  const matching = routes.filter((route) => route.markets.includes(market));
  if (matching.length === 0) return 0;
  matching.sort((a, b) => a.markets.length - b.markets.length);
  return matching[0].parkingFee ?? 0;
}

function sumUnloadingByMarkets(
  rows: Awaited<ReturnType<typeof listUnloadingFees>>,
  markets: string[],
  mode: "kpb" | "unload"
) {
  let total = 0;
  for (const row of rows) {
    if (!markets.includes(row.market)) continue;
    total += mode === "kpb" ? effectiveKpbFee(row) : effectiveUnloadFee(row);
  }
  return roundMoney(total);
}

function hasAnyMarket(tripMarkets: string[], markets: string[]) {
  return markets.some((market) => tripMarkets.includes(market));
}

export async function getVoucherPrintBreakdown(tripId: string) {
  const dispatch = await loadDispatchForExpense(tripId);
  const [unloadingFees, loadingFees, routes] = await Promise.all([
    listUnloadingFees({ tripId }),
    listCrateLoadingFees({ tripId }),
    prisma.routeMaster.findMany({ where: { active: true } }),
  ]);

  const routeRows: RouteMasterCostRow[] = routes.map((route) => ({
    code: route.code,
    markets: route.markets,
    sadooMileageKm: decimalToNumber(route.sadooMileageKm),
    tollFee: decimalToNumber(route.tollFee),
    tollFeeClass2: decimalToNumber(route.tollFeeClass2),
    tollFeeClass3: decimalToNumber(route.tollFeeClass3),
    fishCheckingFee: decimalToNumber(route.fishCheckingFee),
    parkingFee: decimalToNumber(route.parkingFee),
  }));

  const mcAssignedLines = mcAssignedLinesFromDispatchLines(dispatch.lines);
  const effectiveMarkets = effectiveMarketsForTripCost(
    dispatch.markets,
    mcAssignedLines
  );
  const tripMarkets = normalizeTripMarkets(effectiveMarkets);

  const KL_GROUP = ["KL", "BP", "MP", "SL"];
  const BM_PINDAH_GROUP = ["P", "TP", "KT", "NT", "SA"];
  const bmPindahTripFee = bmPindahTripUnloadFee(
    resolveTruckSize(dispatch.truck.type)
  );

  const parking: { market: string; suggested: number }[] = [];
  if (hasAnyMarket(tripMarkets, KL_GROUP)) {
    const value = roundMoney(parkingFeeForMarket("KL", routeRows));
    if (value > 0) parking.push({ market: "KL", suggested: value });
  }
  for (const market of ["BM", "A", "KD", "MC"]) {
    if (!tripMarkets.includes(market)) continue;
    const value = roundMoney(parkingFeeForMarket(market, routeRows));
    if (value > 0) parking.push({ market, suggested: value });
  }

  const kpb: { market: string; suggested: number }[] = [];
  if (hasAnyMarket(tripMarkets, KL_GROUP)) {
    const value = sumUnloadingByMarkets(unloadingFees, KL_GROUP, "kpb");
    if (value > 0) kpb.push({ market: "KL", suggested: value });
  }
  for (const market of ["BM", "A", "KD", "MC"]) {
    if (!tripMarkets.includes(market)) continue;
    const value = sumUnloadingByMarkets(unloadingFees, [market], "kpb");
    if (value > 0) kpb.push({ market, suggested: value });
  }

  const upahTurun: { market: string; suggested: number }[] = [];
  if (hasAnyMarket(tripMarkets, KL_GROUP)) {
    const value = sumUnloadingByMarkets(unloadingFees, KL_GROUP, "unload");
    if (value > 0) upahTurun.push({ market: "KL", suggested: value });
  }
  if (tripMarkets.includes("BM")) {
    const value = sumUnloadingByMarkets(unloadingFees, ["BM"], "unload");
    if (value > 0) upahTurun.push({ market: "BM", suggested: value });
  }
  if (hasAnyMarket(tripMarkets, BM_PINDAH_GROUP)) {
    const value = roundMoney(bmPindahTripFee);
    if (value > 0) upahTurun.push({ market: "BM Pindah", suggested: value });
  }
  for (const market of ["A", "KD", "MC"]) {
    if (!tripMarkets.includes(market)) continue;
    const value = sumUnloadingByMarkets(unloadingFees, [market], "unload");
    if (value > 0) upahTurun.push({ market, suggested: value });
  }

  const upahNaikTongSuggested = roundMoney(
    loadingFees.reduce(
      (sum, row) => sum + (row.loadingFeeOverride ?? row.loadingFee),
      0
    )
  );

  const driver = dispatch.driverName
    ? await prisma.driver.findFirst({
        where: {
          OR: [
            { name: dispatch.driverName },
            { fullName: dispatch.driverName },
            { nickname: dispatch.driverName },
          ],
        },
        select: { nickname: true, name: true, fullName: true },
      })
    : null;
  const driverDisplayName =
    driver?.nickname?.trim() ||
    dispatch.driverName ||
    driver?.name ||
    driver?.fullName ||
    "";

  return {
    driverDisplayName,
    parking,
    kpb,
    upahTurun,
    upahNaikTongLabel: `Upah Naik Tong / Crate Loading ${formatTripRouteLabel(dispatch.markets)}`,
    upahNaikTongSuggested,
  };
}

export async function syncTripDriverExpenses(tripId: string) {
  const [unloading, loading] = await Promise.all([
    syncUnloadingFeeEstimatesForTrip(tripId),
    generateCrateLoadingFeesForTrip(tripId),
  ]);
  return { unloading, loading };
}

export async function listDispatchesForExpenseDate(dateStr: string) {
  const date = parseDateInput(dateStr);
  return prisma.dispatchOrder.findMany({
    where: { date, status: { notIn: ["draft", "cancelled"] } },
    include: { truck: true },
    orderBy: { createdAt: "asc" },
  });
}

export { effectiveKpbFee, effectiveUnloadFee, lineSubtotal, truckSizeLabel };
