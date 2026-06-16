import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/date-utils";
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
  calculateTripUnloadingFees,
  effectiveKpbFee,
  effectiveUnloadFee,
  lineSubtotal,
  type UnloadingMarketLineInput,
  type UnloadingRateConfigInput,
} from "@/lib/unloading-calculator";
import { decimalToNumber } from "@/lib/freight-rates";
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
  const byMarket = new Map<
    string,
    UnloadingMarketLineInput & { storeCode: string | null }
  >();

  for (const dl of dispatch.lines) {
    const line = dl.inboundLine;
    if (!line || line.dispatchStatus !== "assigned") continue;
    const market = line.stall.market?.code?.trim().toUpperCase();
    if (!market) continue;

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

export async function generateUnloadingFeesForTrip(tripId: string) {
  const dispatch = await loadDispatchForExpense(tripId);
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

  await prisma.unloadingFee.deleteMany({ where: { tripId } });

  if (calculated.length === 0) return [];

  return prisma.unloadingFee.createManyAndReturn({
    data: calculated.map((row) => ({
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
    })),
  });
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

  return prisma.driverVoucher.findMany({
    where,
    orderBy: [{ tripDate: "desc" }, { voucherNo: "desc" }],
  });
}

export async function getDriverVoucher(id: string) {
  return prisma.driverVoucher.findUnique({ where: { id } });
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
    fishCheckingFee: decimalToNumber(route.fishCheckingFee),
    parkingFee: decimalToNumber(route.parkingFee),
  }));

  const applicableRoutes = findApplicableRoutes(dispatch.markets, routeRows);
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

export async function createDriverVoucher(input: {
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
}) {
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

  const voucher = await prisma.driverVoucher.create({ data: draft });
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
  input: Partial<{
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
  }>
) {
  const existing = await prisma.driverVoucher.findUnique({ where: { id } });
  if (!existing) throw new Error("Voucher not found");

  const merged = { ...existing, ...input };
  const belanja = sumActualBelanja(merged);
  const baki =
    merged.duitJalan != null
      ? roundMoney(merged.duitJalan - belanja)
      : null;

  const voucher = await prisma.driverVoucher.update({
    where: { id },
    data: { ...input, belanja, baki },
  });
  await writebackVoucherActuals({
    tripId: voucher.tripId,
    kpbActual: voucher.kpbActual,
    upahTurunActual: voucher.upahTurunActual,
    upahNaikTongActual: voucher.upahNaikTongActual,
  });
  return voucher;
}

function parkingFeeForMarket(
  market: string,
  routes: RouteMasterCostRow[]
): number {
  const matching = routes.filter((route) => route.markets.includes(market));
  if (matching.length === 0) return 0;
  matching.sort((a, b) => a.markets.length - b.markets.length);
  return matching[0].parkingFee ?? 0;
}

function orderMarketFeeRows(
  tripMarkets: string[],
  feesByMarket: Map<string, number>
) {
  const rows: { market: string; suggested: number }[] = [];
  for (const market of tripMarkets) {
    const suggested = feesByMarket.get(market);
    if (suggested != null && suggested > 0) {
      rows.push({ market, suggested });
    }
  }
  for (const market of Array.from(feesByMarket.keys())) {
    const suggested = feesByMarket.get(market);
    if (!tripMarkets.includes(market) && suggested != null && suggested > 0) {
      rows.push({ market, suggested });
    }
  }
  return rows;
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
    fishCheckingFee: decimalToNumber(route.fishCheckingFee),
    parkingFee: decimalToNumber(route.parkingFee),
  }));

  const tripMarkets = normalizeTripMarkets(dispatch.markets);

  const parking = tripMarkets
    .map((market) => ({
      market,
      suggested: roundMoney(parkingFeeForMarket(market, routeRows)),
    }))
    .filter((row) => row.suggested > 0);

  const kpbByMarket = new Map<string, number>();
  for (const row of unloadingFees) {
    const fee = effectiveKpbFee(row);
    if (fee <= 0) continue;
    kpbByMarket.set(
      row.market,
      roundMoney((kpbByMarket.get(row.market) ?? 0) + fee)
    );
  }

  const upahTurunByMarket = new Map<string, number>();
  for (const row of unloadingFees) {
    const fee = effectiveUnloadFee(row);
    if (fee <= 0) continue;
    upahTurunByMarket.set(
      row.market,
      roundMoney((upahTurunByMarket.get(row.market) ?? 0) + fee)
    );
  }

  const upahNaikTongSuggested = roundMoney(
    loadingFees.reduce(
      (sum, row) => sum + (row.loadingFeeOverride ?? row.loadingFee),
      0
    )
  );

  return {
    parking,
    kpb: orderMarketFeeRows(tripMarkets, kpbByMarket),
    upahTurun: orderMarketFeeRows(tripMarkets, upahTurunByMarket),
    upahNaikTongLabel: `Upah Naik Tong / Crate Loading ${formatTripRouteLabel(dispatch.markets)}`,
    upahNaikTongSuggested,
  };
}

export async function syncTripDriverExpenses(tripId: string) {
  const [unloading, loading] = await Promise.all([
    generateUnloadingFeesForTrip(tripId),
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
