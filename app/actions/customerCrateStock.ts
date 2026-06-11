"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export interface CrateTypeColumn {
  id: string;
  code: string;
  name: string;
}

export interface CustomerCrateLocationStock {
  location: string;
  quantities: Record<string, number>;
}

export interface CustomerCrateStockRow {
  shipperId: string;
  shipperCode: string;
  shipperName: string;
  quantities: Record<string, number>;
  locations: CustomerCrateLocationStock[];
}

export interface CustomerCrateLedgerEntry {
  id: string;
  crateTypeCode: string;
  crateTypeName: string;
  location: string;
  changeType: string;
  quantity: number;
  balance: number;
  notes: string | null;
  createdAt: Date;
}

function normalizeLocation(location?: string | null): string {
  return location?.trim() ?? "";
}

function stockWhere(
  shipperId: string,
  crateTypeId: string,
  location?: string | null
) {
  return {
    shipperId_crateTypeId_location: {
      shipperId,
      crateTypeId,
      location: normalizeLocation(location),
    },
  };
}

async function getTrackedCrateTypes(): Promise<CrateTypeColumn[]> {
  return prisma.tongType.findMany({
    where: { active: true, trackInventory: true, isBox: false },
    orderBy: { displayOrder: "asc" },
    select: { id: true, code: true, name: true },
  });
}

function initQuantities(crateTypes: CrateTypeColumn[]): Record<string, number> {
  const quantities: Record<string, number> = {};
  for (const crateType of crateTypes) {
    quantities[crateType.id] = 0;
  }
  return quantities;
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
        select: { crateTypeId: true, location: true, quantity: true },
      },
    },
  });

  const rows: CustomerCrateStockRow[] = shippers.map((shipper) => {
    const quantities = initQuantities(crateTypes);
    const locationMap = new Map<string, Record<string, number>>();

    for (const stock of shipper.customerCrateStock) {
      const loc = normalizeLocation(stock.location);
      if (!locationMap.has(loc)) {
        locationMap.set(loc, initQuantities(crateTypes));
      }
      const locQty = locationMap.get(loc)!;
      locQty[stock.crateTypeId] = stock.quantity;
      quantities[stock.crateTypeId] =
        (quantities[stock.crateTypeId] ?? 0) + stock.quantity;
    }

    const locations = Array.from(locationMap.entries())
      .map(([location, locQuantities]) => ({
        location,
        quantities: locQuantities,
      }))
      .sort((a, b) => {
        if (a.location === "") return 1;
        if (b.location === "") return -1;
        return a.location.localeCompare(b.location);
      });

    return {
      shipperId: shipper.id,
      shipperCode: shipper.code,
      shipperName: shipper.name,
      quantities,
      locations,
    };
  });

  return { crateTypes, rows };
}

export async function updateCustomerCrateStock(
  shipperId: string,
  crateTypeId: string,
  quantity: number,
  location: string,
  notes?: string
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  const loc = normalizeLocation(location);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.customerCrateStock.findUnique({
      where: stockWhere(shipperId, crateTypeId, loc),
    });

    const previousQty = existing?.quantity ?? 0;
    const delta = quantity - previousQty;
    if (delta === 0) return;

    await tx.customerCrateStock.upsert({
      where: stockWhere(shipperId, crateTypeId, loc),
      create: { shipperId, crateTypeId, location: loc, quantity },
      update: { quantity },
    });

    await tx.customerCrateLedger.create({
      data: {
        shipperId,
        crateTypeId,
        location: loc,
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
    location: entry.location,
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
  location: string,
  notes?: string
) {
  if (quantity <= 0) return;

  const crateType = await prisma.tongType.findUnique({
    where: { id: crateTypeId },
    select: { isBox: true },
  });
  if (crateType?.isBox) return;

  const loc = normalizeLocation(location);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.customerCrateStock.findUnique({
      where: stockWhere(shipperId, crateTypeId, loc),
    });

    const previousQty = existing?.quantity ?? 0;
    const newQty = previousQty + quantity;

    await tx.customerCrateStock.upsert({
      where: stockWhere(shipperId, crateTypeId, loc),
      create: { shipperId, crateTypeId, location: loc, quantity },
      update: { quantity: newQty },
    });

    await tx.customerCrateLedger.create({
      data: {
        shipperId,
        crateTypeId,
        location: loc,
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
  location: string,
  notes?: string
) {
  if (quantity <= 0) return;

  const crateType = await prisma.tongType.findUnique({
    where: { id: crateTypeId },
    select: { isBox: true },
  });
  if (crateType?.isBox) return;

  const loc = normalizeLocation(location);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.customerCrateStock.findUnique({
      where: stockWhere(shipperId, crateTypeId, loc),
    });

    const previousQty = existing?.quantity ?? 0;
    const newQty = previousQty - quantity;

    await tx.customerCrateStock.upsert({
      where: stockWhere(shipperId, crateTypeId, loc),
      create: { shipperId, crateTypeId, location: loc, quantity: -quantity },
      update: { quantity: newQty },
    });

    await tx.customerCrateLedger.create({
      data: {
        shipperId,
        crateTypeId,
        location: loc,
        changeType,
        quantity: -quantity,
        balance: newQty,
        notes: notes?.trim() || null,
      },
    });
  });
}
