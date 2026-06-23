import { prisma } from "@/lib/prisma";
import { computeSadaoStockByTongType } from "@/lib/sadao-stock";
import { toDateInputValue } from "@/lib/inbound-utils";

export async function generateExportNo(date: Date): Promise<string> {
  const dateStr = toDateInputValue(date).replace(/-/g, "");
  const prefix = `TE-${dateStr}-`;
  const rows = await prisma.tongExport.findMany({
    where: { exportNo: { startsWith: prefix } },
    distinct: ["exportNo"],
    select: { exportNo: true },
  });
  return `${prefix}${String(rows.length + 1).padStart(3, "0")}`;
}

export async function getSadaoStockByTongType(): Promise<
  Record<string, { tongTypeId: string; code: string; name: string; stock: number }>
> {
  const tongTypes = await prisma.tongType.findMany({
    where: { active: true, trackInventory: true },
    orderBy: { displayOrder: "asc" },
    select: { id: true, code: true, name: true },
  });

  const [imports, exports, adjustments] = await Promise.all([
    prisma.tongImport.groupBy({
      by: ["tongTypeId"],
      where: { status: "arrived" },
      _sum: { quantity: true },
    }),
    prisma.tongExport.groupBy({
      by: ["tongTypeId"],
      _sum: { quantityActual: true },
    }),
    prisma.tongStockAdjustment.groupBy({
      by: ["tongTypeId"],
      _sum: { quantity: true },
    }),
  ]);

  const importMap = Object.fromEntries(
    imports.map((row) => [row.tongTypeId, row._sum.quantity ?? 0])
  );
  const exportMap = Object.fromEntries(
    exports.map((row) => [row.tongTypeId, row._sum.quantityActual ?? 0])
  );
  const adjustmentMap = Object.fromEntries(
    adjustments.map((row) => [row.tongTypeId, row._sum.quantity ?? 0])
  );

  return computeSadaoStockByTongType({
    tongTypes,
    importQtyByTongTypeId: importMap,
    exportQtyByTongTypeId: exportMap,
    adjustmentQtyByTongTypeId: adjustmentMap,
  });
}
