"use server";

import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/inbound-utils";
import { getSadaoStockByTongType } from "@/lib/tong";
import { formatDisplayDate } from "@/lib/date-utils";
import {
  confirmCrateImportArrived,
  getDispatchedTruckPlatesForDate,
  loadCrateImportsForDate,
  saveCrateImport,
  type CrateImportRowInput,
} from "@/app/actions/crateImport";
import { sortMarketsForImport } from "@/lib/constants/import-markets";
import {
  saveCrateExport,
  type CrateExportLineInput,
} from "@/app/actions/crateExport";

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
    where: { active: true },
    select: { id: true, code: true, name: true },
  });
  return sortMarketsForImport(markets);
}

export async function getCrateImportPageData(dateStr: string) {
  const [trucks, markets, importData] = await Promise.all([
    getTrucksForImport(),
    getMarketsForImport(),
    loadCrateImportsForDate(dateStr),
  ]);

  return {
    trucks,
    markets,
    ...importData,
  };
}

export { getDispatchedTruckPlatesForDate, loadCrateImportsForDate };

export async function getTongTypesForExport() {
  return prisma.tongType.findMany({
    where: { active: true, trackInventory: true },
    orderBy: { displayOrder: "asc" },
    select: { id: true, code: true, name: true },
  });
}

export async function getShippersForExport() {
  return prisma.shipper.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
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

  const imports = await prisma.tongImport.findMany({
    where,
    include: {
      truck: true,
      market: true,
      tongType: true,
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const exports = await prisma.tongExport.findMany({
    where,
    include: {
      shipper: true,
      tongType: true,
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  type LedgerEntry = {
    date: Date;
    type: "IN" | "OUT";
    plate: string;
    party: string;
    tongCode: string;
    quantity: number;
    createdAt: Date;
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
  ];

  entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const stock = await getSadaoStockByTongType();
  const balanceMap = Object.fromEntries(
    Object.values(stock).map((s) => [s.code, s.stock])
  );

  return entries.map((e) => ({
    ...e,
    date: formatDisplayDate(e.date),
    signedQty: e.type === "IN" ? `+${e.quantity}` : `-${e.quantity}`,
    balance: balanceMap[e.tongCode] ?? 0,
  }));
}
