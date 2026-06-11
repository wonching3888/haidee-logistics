"use server";

import { revalidatePath } from "next/cache";
import { addCustomerCrate } from "@/app/actions/customerCrateStock";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/inbound-utils";
import { generateExportNo, getSadaoStockByTongType } from "@/lib/tong";
import { formatDisplayDate } from "@/lib/date-utils";

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
  const stock = await getSadaoStockByTongType();
  const exportNo = await generateExportNo(date);

  const shipper = await prisma.shipper.findUnique({
    where: { id: input.shipperId },
  });
  if (!shipper) throw new Error("寄货人不存在 Shipper not found");

  const activeLines = input.lines.filter(
    (l) => l.quantityActual > 0 || l.quantitySuggested > 0
  );
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
      await addCustomerCrate(
        input.shipperId,
        line.tongTypeId,
        actual,
        "export",
        input.location ?? "",
        exportNo ? `归还 ${exportNo}` : undefined
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
