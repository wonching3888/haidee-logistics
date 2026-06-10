"use server";

import { revalidatePath } from "next/cache";
import { deductCustomerCrate } from "@/app/actions/customerCrateStock";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/inbound-utils";
import { TONG_IMPORT_COLUMNS } from "@/lib/constants/tong-import-columns";
import { generateExportNo, getSadaoStockByTongType } from "@/lib/tong";
import { formatDisplayDate } from "@/lib/date-utils";

export interface ImportRowInput {
  truckPlate: string;
  marketCode: string;
  quantities: Record<string, string>;
  notes?: string;
  status?: "on_the_way" | "arrived";
}

export interface ExportLineInput {
  tongTypeId: string;
  quantitySuggested: number;
  quantityActual: number;
}

export async function getTrucksForImport() {
  return prisma.truck.findMany({
    where: { active: true },
    orderBy: { plate: "asc" },
    select: { id: true, plate: true },
  });
}

export async function getMarketsForImport() {
  return prisma.market.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}

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

export async function saveTongImport(dateStr: string, rows: ImportRowInput[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  const date = parseDateInput(dateStr);
  const trucks = await prisma.truck.findMany();
  const truckMap = Object.fromEntries(trucks.map((t) => [t.plate, t.id]));
  const markets = await prisma.market.findMany();
  const marketMap = Object.fromEntries(markets.map((m) => [m.code, m.id]));
  const tongTypes = await prisma.tongType.findMany();
  const tongMap = Object.fromEntries(tongTypes.map((t) => [t.code, t.id]));

  await prisma.tongImport.deleteMany({ where: { date } });

  for (const row of rows) {
    if (!row.truckPlate) continue;
    const truckId = truckMap[row.truckPlate];
    if (!truckId) throw new Error(`车牌不存在 Unknown plate: ${row.truckPlate}`);

    if (row.marketCode === "X" || row.marketCode === "x") continue;

    const marketId = marketMap[row.marketCode];
    if (!marketId)
      throw new Error(`市场代码无效 Invalid market: ${row.marketCode}`);

    for (const col of TONG_IMPORT_COLUMNS) {
      const qty = parseInt(row.quantities[col.key] ?? "0", 10) || 0;
      if (qty <= 0) continue;

      const tongTypeId = tongMap[col.tongCode];
      if (!tongTypeId) continue;

      const status = row.status ?? "on_the_way";
      await prisma.tongImport.create({
        data: {
          date,
          truckId,
          marketId,
          tongTypeId,
          quantity: qty,
          status,
          arrivedAt: status === "arrived" ? new Date() : null,
          notes: row.notes || null,
          createdById: user.id,
        },
      });
    }
  }

  revalidatePath("/tong/import");
  revalidatePath("/crate/import");
  revalidatePath("/tong/stock");
  revalidatePath("/crate/stock");
}

export async function markImportsArrived(dateStr: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  const date = parseDateInput(dateStr);
  await prisma.tongImport.updateMany({
    where: { date, status: "on_the_way" },
    data: { status: "arrived", arrivedAt: new Date() },
  });

  revalidatePath("/tong/import");
  revalidatePath("/crate/import");
  revalidatePath("/tong/stock");
  revalidatePath("/crate/stock");
}

export async function saveTongExport(input: {
  date: string;
  shipperId: string;
  thVehiclePlate: string;
  areaNote?: string;
  lines: ExportLineInput[];
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  const date = parseDateInput(input.date);
  const stock = await getSadaoStockByTongType();
  const exportNo = await generateExportNo(date);

  const shipper = await prisma.shipper.findUnique({
    where: { id: input.shipperId },
  });
  if (!shipper) throw new Error("寄货人不存在 Shipper not found");

  const activeLines = input.lines.filter((l) => l.quantityActual > 0 || l.quantitySuggested > 0);
  if (activeLines.length === 0) {
    throw new Error("请至少填写一行归还数据 Please enter at least one line");
  }

  const receiptLines: {
    tongName: string;
    quantity: number;
    quantityActual: number;
    shortage: number;
  }[] = [];

  for (const line of activeLines) {
    const tongType = await prisma.tongType.findUnique({
      where: { id: line.tongTypeId },
    });
    if (!tongType) continue;

    const available = stock[tongType.code]?.stock ?? 0;
    const actual = Math.min(line.quantityActual, available);
    const shortage = Math.max(0, line.quantitySuggested - actual);

    await prisma.tongExport.create({
      data: {
        exportNo,
        date,
        thVehiclePlate: input.thVehiclePlate,
        areaNote: input.areaNote?.trim() || null,
        shipperId: input.shipperId,
        tongTypeId: line.tongTypeId,
        quantitySuggested: line.quantitySuggested,
        quantityActual: actual,
        shortage,
        createdById: user.id,
      },
    });

    if (actual > 0) {
      await deductCustomerCrate(
        input.shipperId,
        line.tongTypeId,
        actual,
        exportNo ? `归还 ${exportNo}` : "空桶归还 Crate export"
      );
    }

    if (actual > 0 || shortage > 0) {
      receiptLines.push({
        tongName: tongType.name,
        quantity: line.quantitySuggested,
        quantityActual: actual,
        shortage,
      });
    }
  }

  revalidatePath("/tong/export");
  revalidatePath("/crate/export");
  revalidatePath("/tong/stock");
  revalidatePath("/crate/stock");
  revalidatePath("/crate/customer-stock");

  return {
    exportNo,
    date: formatDisplayDate(date),
    shipperName: shipper.name,
    thVehiclePlate: input.thVehiclePlate,
    lines: receiptLines,
  };
}

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
