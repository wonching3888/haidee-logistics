"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/inbound-utils";
import { TONG_IMPORT_COLUMNS } from "@/lib/constants/tong-import-columns";

export interface CrateImportRowInput {
  truckPlate: string;
  marketCode: string;
  quantities: Record<string, string>;
  notes?: string;
  status?: "on_the_way" | "arrived";
}

/**
 * Save crate import records. SADAO stock increases when status is "arrived"
 * (computed from tong_imports). Customer crate stock is not affected.
 */
export async function saveCrateImport(
  dateStr: string,
  rows: CrateImportRowInput[]
) {
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

/** Mark in-transit imports as arrived — SADAO stock +quantity per crate type. */
export async function confirmCrateImportArrived(dateStr: string) {
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
