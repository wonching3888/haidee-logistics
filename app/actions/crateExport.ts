"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { addCustomerCratesBatch } from "@/app/actions/customerCrateStock";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/inbound-utils";
import { generateExportNo, getSadaoStockByTongType } from "@/lib/tong";
import { formatDisplayDate } from "@/lib/date-utils";
import { stockLocationForPoolShipperCode } from "@/lib/constants/location-pool-shippers";

export interface CrateExportLineInput {
  tongTypeId: string;
  quantitySuggested: number;
  quantityActual: number;
}

/**
 * Save crate export (return empty crates to shipper).
 * SADAO stock -quantity via tong_exports; customer stock +quantity.
 */
export async function saveCrateExport(input: {
  date: string;
  shipperId: string;
  thVehiclePlate: string;
  areaNote?: string;
  location?: string;
  lines: CrateExportLineInput[];
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  const date = parseDateInput(input.date);
  const activeLines = input.lines.filter(
    (l) => l.quantityActual > 0 || l.quantitySuggested > 0
  );
  if (activeLines.length === 0) {
    throw new Error("请至少填写一行归还数据 Please enter at least one line");
  }

  const tongTypeIds = Array.from(
    new Set(activeLines.map((line) => line.tongTypeId))
  );

  const [stock, exportNo, shipper, tongTypes] = await Promise.all([
    getSadaoStockByTongType(),
    generateExportNo(date),
    prisma.shipper.findUnique({
      where: { id: input.shipperId },
      select: { name: true, code: true },
    }),
    prisma.tongType.findMany({
      where: { id: { in: tongTypeIds } },
      select: { id: true, code: true, name: true, isBox: true },
    }),
  ]);

  if (!shipper) throw new Error("寄货人不存在 Shipper not found");

  const poolStockLocation = stockLocationForPoolShipperCode(shipper.code);
  const customerStockLocation =
    poolStockLocation ?? input.location?.trim() ?? "";

  const tongTypeMap = new Map(tongTypes.map((t) => [t.id, t]));
  const exportRows: Prisma.TongExportCreateManyInput[] = [];
  const crateAdditions: { crateTypeId: string; quantity: number }[] = [];
  const receiptLines: {
    tongName: string;
    quantity: number;
    quantityActual: number;
    shortage: number;
  }[] = [];

  for (const line of activeLines) {
    const tongType = tongTypeMap.get(line.tongTypeId);
    if (!tongType || tongType.isBox) continue;

    const available = stock[tongType.code]?.stock ?? 0;
    const actual = Math.min(line.quantityActual, available);
    const shortage = Math.max(0, line.quantitySuggested - actual);

    exportRows.push({
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
    });

    if (actual > 0) {
      crateAdditions.push({ crateTypeId: line.tongTypeId, quantity: actual });
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

  if (exportRows.length === 0) {
    throw new Error("请至少填写一行归还数据 Please enter at least one line");
  }

  await prisma.tongExport.createMany({ data: exportRows });

  if (crateAdditions.length > 0) {
    await addCustomerCratesBatch(
      input.shipperId,
      crateAdditions,
      "export",
      customerStockLocation,
      exportNo ? `归还 ${exportNo}` : undefined
    );
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
