"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export interface CrateTypeColumn {
  id: string;
  code: string;
  name: string;
}

export interface CustomerCrateStockRow {
  shipperId: string;
  shipperCode: string;
  shipperName: string;
  quantities: Record<string, number>;
}

export interface CustomerCrateLedgerEntry {
  id: string;
  crateTypeCode: string;
  crateTypeName: string;
  changeType: string;
  quantity: number;
  balance: number;
  notes: string | null;
  createdAt: Date;
}

async function getTrackedCrateTypes(): Promise<CrateTypeColumn[]> {
  return prisma.tongType.findMany({
    where: { active: true, trackInventory: true, isBox: false },
    orderBy: { displayOrder: "asc" },
    select: { id: true, code: true, name: true },
  });
}

export async function getCustomerCrateStock(search?: string) {
  const crateTypes = await getTrackedCrateTypes();

  const shippers = await prisma.shipper.findMany({
    where: {
      active: true,
      ...(search?.trim()
        ? {
            OR: [
              { name: { contains: search.trim(), mode: "insensitive" } },
              { code: { contains: search.trim(), mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    include: {
      customerCrateStock: {
        select: { crateTypeId: true, quantity: true },
      },
    },
  });

  const rows: CustomerCrateStockRow[] = shippers.map((shipper) => {
    const quantities: Record<string, number> = {};
    for (const crateType of crateTypes) {
      quantities[crateType.id] = 0;
    }
    for (const stock of shipper.customerCrateStock) {
      quantities[stock.crateTypeId] = stock.quantity;
    }
    return {
      shipperId: shipper.id,
      shipperCode: shipper.code,
      shipperName: shipper.name,
      quantities,
    };
  });

  return { crateTypes, rows };
}

export async function updateCustomerCrateStock(
  shipperId: string,
  crateTypeId: string,
  quantity: number,
  notes?: string
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  await prisma.$transaction(async (tx) => {
    const existing = await tx.customerCrateStock.findUnique({
      where: { shipperId_crateTypeId: { shipperId, crateTypeId } },
    });

    const previousQty = existing?.quantity ?? 0;
    const delta = quantity - previousQty;
    if (delta === 0) return;

    await tx.customerCrateStock.upsert({
      where: { shipperId_crateTypeId: { shipperId, crateTypeId } },
      create: { shipperId, crateTypeId, quantity },
      update: { quantity },
    });

    await tx.customerCrateLedger.create({
      data: {
        shipperId,
        crateTypeId,
        changeType: "manual",
        quantity: delta,
        balance: quantity,
        notes: notes?.trim() || null,
      },
    });
  });

  revalidatePath("/crate/customer-stock");
}

export async function getCustomerCrateLedger(
  shipperId: string,
  limit = 10
): Promise<CustomerCrateLedgerEntry[]> {
  const entries = await prisma.customerCrateLedger.findMany({
    where: { shipperId },
    include: {
      crateType: { select: { code: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return entries.map((entry) => ({
    id: entry.id,
    crateTypeCode: entry.crateType.code,
    crateTypeName: entry.crateType.name,
    changeType: entry.changeType,
    quantity: entry.quantity,
    balance: entry.balance,
    notes: entry.notes,
    createdAt: entry.createdAt,
  }));
}

/** Increase customer crate stock (e.g. crate export return to shipper). */
export async function addCustomerCrate(
  shipperId: string,
  crateTypeId: string,
  quantity: number,
  changeType: string,
  notes?: string
) {
  if (quantity <= 0) return;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.customerCrateStock.findUnique({
      where: { shipperId_crateTypeId: { shipperId, crateTypeId } },
    });

    const previousQty = existing?.quantity ?? 0;
    const newQty = previousQty + quantity;

    await tx.customerCrateStock.upsert({
      where: { shipperId_crateTypeId: { shipperId, crateTypeId } },
      create: { shipperId, crateTypeId, quantity },
      update: { quantity: newQty },
    });

    await tx.customerCrateLedger.create({
      data: {
        shipperId,
        crateTypeId,
        changeType,
        quantity,
        balance: newQty,
        notes: notes?.trim() || null,
      },
    });
  });
}

/** Decrease customer crate stock (e.g. inbound cargo shipped to Malaysia). */
export async function deductCustomerCrate(
  shipperId: string,
  crateTypeId: string,
  quantity: number,
  changeType: string,
  notes?: string
) {
  if (quantity <= 0) return;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.customerCrateStock.findUnique({
      where: { shipperId_crateTypeId: { shipperId, crateTypeId } },
    });

    const previousQty = existing?.quantity ?? 0;
    const newQty = previousQty - quantity;

    await tx.customerCrateStock.upsert({
      where: { shipperId_crateTypeId: { shipperId, crateTypeId } },
      create: { shipperId, crateTypeId, quantity: -quantity },
      update: { quantity: newQty },
    });

    await tx.customerCrateLedger.create({
      data: {
        shipperId,
        crateTypeId,
        changeType,
        quantity: -quantity,
        balance: newQty,
        notes: notes?.trim() || null,
      },
    });
  });
}
