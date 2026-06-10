import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/inbound-utils";

export async function generateExportNo(date: Date): Promise<string> {
  const dateStr = toDateInputValue(date).replace(/-/g, "");
  const prefix = `TE-${dateStr}-`;
  const count = await prisma.tongExport.count({
    where: { exportNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export async function getSadaoStockByTongType(): Promise<
  Record<string, { tongTypeId: string; code: string; name: string; stock: number }>
> {
  const tongTypes = await prisma.tongType.findMany({
    where: { active: true, trackInventory: true },
    orderBy: { displayOrder: "asc" },
  });

  const imports = await prisma.tongImport.groupBy({
    by: ["tongTypeId"],
    where: { status: "arrived" },
    _sum: { quantity: true },
  });

  const exports = await prisma.tongExport.groupBy({
    by: ["tongTypeId"],
    _sum: { quantityActual: true },
  });

  const importMap = Object.fromEntries(
    imports.map((i) => [i.tongTypeId, i._sum.quantity ?? 0])
  );
  const exportMap = Object.fromEntries(
    exports.map((e) => [e.tongTypeId, e._sum.quantityActual ?? 0])
  );

  const result: Record<
    string,
    { tongTypeId: string; code: string; name: string; stock: number }
  > = {};

  for (const t of tongTypes) {
    result[t.code] = {
      tongTypeId: t.id,
      code: t.code,
      name: t.name,
      stock: (importMap[t.id] ?? 0) - (exportMap[t.id] ?? 0),
    };
  }

  return result;
}
