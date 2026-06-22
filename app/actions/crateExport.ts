"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { addCustomerCratesBatch } from "@/app/actions/customerCrateStock";
import type { ReceiptData } from "@/components/tong/TongExportReceipt";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireWrite } from "@/lib/require-auth";
import { parseDateInput, toDateInputValue } from "@/lib/inbound-utils";
import { generateExportNo, getSadaoStockByTongType } from "@/lib/tong";
import { formatDisplayDate } from "@/lib/date-utils";
import {
  CRATE_EXPORT_LIST_LIMIT,
  type CrateExportListRow,
} from "@/lib/crate-export-list";
import { stockLocationForPoolShipperCode } from "@/lib/constants/location-pool-shippers";

export interface CrateExportLineInput {
  tongTypeId: string;
  quantitySuggested: number;
  quantityActual: number;
}

export type { CrateExportListRow };

/** List crate export batches for a calendar day (grouped by exportNo). */
export async function listCrateExportsForDate(
  dateInput: string
): Promise<CrateExportListRow[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const date = parseDateInput(dateInput);
  const rows = await prisma.tongExport.findMany({
    where: { date },
    include: { shipper: { select: { name: true } } },
    orderBy: [{ createdAt: "desc" }],
    take: CRATE_EXPORT_LIST_LIMIT * 20,
  });

  const grouped = new Map<
    string,
    CrateExportListRow & { sortCreatedAt: number }
  >();

  for (const row of rows) {
    const exportNo = row.exportNo?.trim() || row.id;
    const existing = grouped.get(exportNo);
    if (existing) {
      existing.totalActual += row.quantityActual;
      existing.totalShortage += row.shortage;
      existing.lineCount += 1;
      continue;
    }

    grouped.set(exportNo, {
      exportNo,
      date: toDateInputValue(row.date),
      shipperName: row.shipper.name,
      thVehiclePlate: row.thVehiclePlate,
      totalActual: row.quantityActual,
      totalShortage: row.shortage,
      lineCount: 1,
      sortCreatedAt: row.createdAt.getTime(),
    });
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.sortCreatedAt - a.sortCreatedAt)
    .slice(0, CRATE_EXPORT_LIST_LIMIT)
    .map((row) => ({
      exportNo: row.exportNo,
      date: row.date,
      shipperName: row.shipperName,
      thVehiclePlate: row.thVehiclePlate,
      totalActual: row.totalActual,
      totalShortage: row.totalShortage,
      lineCount: row.lineCount,
    }));
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
  const user = await requireWrite();

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
  revalidatePath("/crate/export/print");
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

/** Load receipt data for print / reprint by export batch number. */
export async function getCrateExportReceiptData(
  exportNo: string
): Promise<ReceiptData | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const trimmed = exportNo.trim();
  if (!trimmed) return null;

  const rows = await prisma.tongExport.findMany({
    where: { exportNo: trimmed },
    include: {
      shipper: { select: { name: true } },
      tongType: { select: { name: true, displayOrder: true } },
    },
    orderBy: { tongType: { displayOrder: "asc" } },
  });

  if (rows.length === 0) return null;

  const first = rows[0];
  const lines = rows
    .filter((row) => row.quantityActual > 0 || row.shortage > 0)
    .map((row) => ({
      tongName: row.tongType.name,
      quantity: row.quantitySuggested ?? 0,
      quantityActual: row.quantityActual,
      shortage: row.shortage,
    }));

  return {
    exportNo: trimmed,
    date: formatDisplayDate(first.date),
    shipperName: first.shipper.name,
    thVehiclePlate: first.thVehiclePlate,
    lines,
  };
}
