"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDateInput, toDateInputValue } from "@/lib/inbound-utils";
import { getSadaoStockByTongType } from "@/lib/tong";
import { formatDisplayDate } from "@/lib/date-utils";
import { computeTongStockDeltaForTarget } from "@/lib/sadao-stock";
import { INBOUND_VISIBLE_TONG_TYPE_WHERE } from "@/lib/constants/tong-type-scope";
import {
  confirmCrateImportArrived,
  getCrateTypesForImport,
  getDispatchedTruckPlatesForDate,
  loadCrateImportsForDate,
  loadInTransitCrateImports,
  markCrateImportRowArrived,
  saveCrateImport,
  type CrateImportRowInput,
} from "@/app/actions/crateImport";
import {
  IMPORT_MARKET_ORDER,
  sortMarketsForImport,
} from "@/lib/constants/import-markets";
import { getMarketDisplayName } from "@/lib/constants/market-names";
import {
  LOCATION_POOL_SHIPPER_LIST,
} from "@/lib/constants/location-pool-shippers";
import { OPERATIONAL_SHIPPER_WHERE } from "@/lib/constants/shipper-kind";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import {
  saveCrateExport,
  type CrateExportLineInput,
} from "@/app/actions/crateExport";
import { requireWrite } from "@/lib/require-auth";

export type ImportRowInput = CrateImportRowInput;

export type ExportLineInput = CrateExportLineInput;

export async function getTrucksForImport() {
  return prisma.truck.findMany({
    where: { active: true },
    orderBy: { plate: "asc" },
    select: { id: true, plate: true },
  });
}

export async function getMarketsForImport() {
  const markets = await prisma.market.findMany({
    where: {
      active: true,
      code: { in: [...IMPORT_MARKET_ORDER] },
    },
    select: { id: true, code: true, name: true },
  });
  return sortMarketsForImport(markets).map((market) => ({
    ...market,
    displayName: getMarketDisplayName(market.code),
  }));
}

export async function getCrateImportPageData(dateStr: string) {
  const [trucks, markets, crateTypes, importData, inTransitData] =
    await Promise.all([
      getTrucksForImport(),
      getMarketsForImport(),
      getCrateTypesForImport(),
      loadCrateImportsForDate(dateStr),
      loadInTransitCrateImports(),
    ]);

  return {
    trucks,
    markets,
    crateTypes,
    ...importData,
    inTransitRows: inTransitData.rows,
    inTransitDynamicColumns: inTransitData.dynamicColumns,
  };
}

export {
  getCrateTypesForImport,
  getDispatchedTruckPlatesForDate,
  loadCrateImportsForDate,
  loadInTransitCrateImports,
  markCrateImportRowArrived,
};

export async function getTongTypesForExport() {
  return prisma.tongType.findMany({
    where: { ...INBOUND_VISIBLE_TONG_TYPE_WHERE, trackInventory: true },
    orderBy: { displayOrder: "asc" },
    select: { id: true, code: true, name: true },
  });
}

async function listLocationPoolShippers() {
  const codes = LOCATION_POOL_SHIPPER_LIST.map((spec) => spec.code);
  return prisma.shipper.findMany({
    where: { code: { in: [...codes] } },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}

/** Seed/update location-pool shippers — call from admin/setup only, not read paths. */
export async function ensureLocationPoolShippers() {
  await requireWrite();

  const shippers = [];
  for (const spec of LOCATION_POOL_SHIPPER_LIST) {
    const shipper = await prisma.shipper.upsert({
      where: { code: spec.code },
      create: {
        code: spec.code,
        name: spec.name,
        pickupLocation: spec.pickupLocation,
        active: true,
      },
      update: {
        name: spec.name,
        pickupLocation: spec.pickupLocation,
        active: true,
      },
      select: { id: true, code: true, name: true },
    });
    shippers.push(shipper);
  }
  return shippers;
}

export async function getShippersForExport() {
  const [poolShippers, shippers] = await Promise.all([
    listLocationPoolShippers(),
    prisma.shipper.findMany({
      where: OPERATIONAL_SHIPPER_WHERE,
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  return [...poolShippers, ...shippers];
}

export async function getThVehiclesForShipper(shipperId: string) {
  return prisma.thVehicle.findMany({
    where: { shipperId, active: true },
    orderBy: { plate: "asc" },
    select: { plate: true },
  });
}

export async function getTodayInboundByShipper(
  dateStr: string,
  shipperId: string
) {
  const date = parseDateInput(dateStr);
  const lines = await prisma.inboundLine.findMany({
    where: {
      session: { date, shipperId, status: "confirmed" },
    },
    include: { tongType: true },
  });

  const map = new Map<
    string,
    { tongTypeId: string; code: string; name: string; quantity: number }
  >();

  for (const line of lines) {
    if (!line.tongType.trackInventory) continue;
    const existing = map.get(line.tongTypeId);
    if (existing) {
      existing.quantity += line.quantity;
    } else {
      map.set(line.tongTypeId, {
        tongTypeId: line.tongTypeId,
        code: line.tongType.code,
        name: line.tongType.name,
        quantity: line.quantity,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.code.localeCompare(b.code)
  );
}

export async function getTodayInboundByPickupLocation(
  dateStr: string,
  pickupLocation: "SONGKHLA" | "PATTANI"
) {
  const date = parseDateInput(dateStr);
  const sessions = await prisma.inboundSession.findMany({
    where: { date, status: "confirmed" },
    include: {
      shipper: { select: { pickupLocation: true } },
      lines: { include: { tongType: true } },
    },
  });

  const map = new Map<
    string,
    { tongTypeId: string; code: string; name: string; quantity: number }
  >();

  for (const session of sessions) {
    const effective = resolveSessionPickupLocation(
      session.pickupLocation,
      session.shipper.pickupLocation
    );
    if (effective !== pickupLocation) continue;

    for (const line of session.lines) {
      if (!line.tongType.trackInventory || line.tongType.isBox) continue;
      const existing = map.get(line.tongTypeId);
      if (existing) {
        existing.quantity += line.quantity;
      } else {
        map.set(line.tongTypeId, {
          tongTypeId: line.tongTypeId,
          code: line.tongType.code,
          name: line.tongType.name,
          quantity: line.quantity,
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.code.localeCompare(b.code)
  );
}

export async function getSadaoStock() {
  const stock = await getSadaoStockByTongType();
  return Object.values(stock);
}

export const saveTongImport = saveCrateImport;
export const markImportsArrived = confirmCrateImportArrived;
export const saveTongExport = saveCrateExport;

export async function getStockOverview(dateStr?: string) {
  const date = dateStr ? parseDateInput(dateStr) : new Date();
  const todayStr = formatDisplayDate(date);

  const stock = await getSadaoStockByTongType();
  const tongTypeIds = Object.values(stock).map((s) => s.tongTypeId);

  const todayImports = await prisma.tongImport.groupBy({
    by: ["tongTypeId"],
    where: { date, status: "arrived" },
    _sum: { quantity: true },
  });

  const todayExports = await prisma.tongExport.groupBy({
    by: ["tongTypeId"],
    where: { date },
    _sum: { quantityActual: true },
  });

  const importMap = Object.fromEntries(
    todayImports.map((i) => [i.tongTypeId, i._sum.quantity ?? 0])
  );
  const exportMap = Object.fromEntries(
    todayExports.map((e) => [e.tongTypeId, e._sum.quantityActual ?? 0])
  );

  const shortages = await prisma.tongExport.findMany({
    where: { shortage: { gt: 0 } },
    include: {
      shipper: { select: { name: true } },
      tongType: { select: { code: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const shortageByTong = Object.fromEntries(
    tongTypeIds.map((id) => {
      const code = Object.values(stock).find((s) => s.tongTypeId === id)?.code;
      const total = shortages
        .filter((s) => s.tongTypeId === id)
        .reduce((sum, s) => sum + s.shortage, 0);
      return [code ?? id, total];
    })
  );

  const stockRows = Object.values(stock)
    .map((s) => ({
      tongTypeId: s.tongTypeId,
      code: s.code,
      name: s.name,
      stock: s.stock,
      todayIn: importMap[s.tongTypeId] ?? 0,
      todayOut: exportMap[s.tongTypeId] ?? 0,
      shortage: shortageByTong[s.code] ?? 0,
    }))
    .filter(
      (row) =>
        row.stock > 0 ||
        row.shortage > 0 ||
        row.todayIn > 0 ||
        row.todayOut > 0
    );

  return {
    stockRows,
    shortages: shortages.map((s) => ({
      shipperName: s.shipper.name,
      tongCode: s.tongType.code,
      tongName: s.tongType.name,
      shortage: s.shortage,
      date: s.date,
      exportNo: s.exportNo,
    })),
    todayStr,
  };
}

export async function getTongLedger(dateStr?: string) {
  const where = dateStr ? { date: parseDateInput(dateStr) } : {};

  const [imports, exports, adjustments] = await Promise.all([
    prisma.tongImport.findMany({
      where,
      include: {
        truck: true,
        market: true,
        tongType: true,
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.tongExport.findMany({
      where,
      include: {
        shipper: true,
        tongType: true,
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.tongStockAdjustment.findMany({
      where,
      include: {
        tongType: true,
        createdBy: { select: { name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  type LedgerEntry = {
    date: Date;
    type: "IN" | "OUT" | "ADJ";
    plate: string;
    party: string;
    tongCode: string;
    quantity: number;
    createdAt: Date;
    balanceAfter?: number | null;
  };

  const entries: LedgerEntry[] = [
    ...imports.map((i) => ({
      date: i.date,
      type: "IN" as const,
      plate: i.truck.plate,
      party: i.market.code,
      tongCode: i.tongType.code,
      quantity: i.quantity,
      createdAt: i.createdAt,
    })),
    ...exports.map((e) => ({
      date: e.date,
      type: "OUT" as const,
      plate: e.thVehiclePlate,
      party: e.shipper.name,
      tongCode: e.tongType.code,
      quantity: e.quantityActual,
      createdAt: e.createdAt,
    })),
    ...adjustments.map((a) => ({
      date: a.date,
      type: "ADJ" as const,
      plate: "—",
      party: a.createdBy?.name?.trim() || "Adjustment",
      tongCode: a.tongType.code,
      quantity: a.quantity,
      createdAt: a.createdAt,
      balanceAfter: a.balanceAfter,
    })),
  ];

  entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const stock = await getSadaoStockByTongType();
  const balanceMap = Object.fromEntries(
    Object.values(stock).map((s) => [s.code, s.stock])
  );

  return entries.map((e) => ({
    ...e,
    date: formatDisplayDate(e.date),
    signedQty:
      e.type === "IN"
        ? `+${e.quantity}`
        : e.type === "OUT"
          ? `-${e.quantity}`
          : e.quantity >= 0
            ? `+${e.quantity}`
            : `${e.quantity}`,
    balance:
      e.type === "ADJ" && e.balanceAfter != null
        ? e.balanceAfter
        : balanceMap[e.tongCode] ?? 0,
  }));
}

export async function setSadaoTongStockAbsolute(input: {
  tongTypeId: string;
  targetQuantity: number;
  date?: string;
  notes?: string;
}) {
  const user = await requireWrite();

  if (!Number.isInteger(input.targetQuantity)) {
    throw new Error("Invalid quantity");
  }

  const tongType = await prisma.tongType.findUnique({
    where: { id: input.tongTypeId },
    select: { id: true, trackInventory: true, isBox: true },
  });
  if (!tongType?.trackInventory || tongType.isBox) {
    throw new Error("Invalid crate type");
  }

  const date = input.date
    ? parseDateInput(input.date)
    : parseDateInput(toDateInputValue(new Date()));

  const stock = await getSadaoStockByTongType();
  const current =
    Object.values(stock).find((row) => row.tongTypeId === input.tongTypeId)
      ?.stock ?? 0;
  const delta = computeTongStockDeltaForTarget(current, input.targetQuantity);

  if (delta === 0) {
    return { ok: true as const, unchanged: true as const };
  }

  await prisma.tongStockAdjustment.create({
    data: {
      date,
      tongTypeId: input.tongTypeId,
      quantity: delta,
      balanceAfter: input.targetQuantity,
      notes: input.notes?.trim() || null,
      createdById: user.id,
    },
  });

  revalidatePath("/tong/stock");
  revalidatePath("/crate/stock");

  return { ok: true as const, unchanged: false as const };
}
