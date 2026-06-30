"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireCustomerCrateStockEdit,
  requireCrateStockAgentAdmin,
} from "@/lib/customer-crate-stock-permissions";
import { requireWrite } from "@/lib/require-auth";
import { sortTongColumnCodes } from "@/lib/constants/tong-columns";
import { CUSTOMER_CRATE_STOCK_LIST_SHIPPER_WHERE, SHIPPER_KIND } from "@/lib/constants/shipper-kind";
import {
  formatPickupLocationLabel,
  PICKUP_CRATE_STOCK_LOCATIONS,
} from "@/lib/constants/pickup-locations";
import { stockLocationForPoolShipperCode } from "@/lib/constants/location-pool-shippers";
import { ensureLocationPoolShippersForStock } from "@/lib/location-pool-shippers-service";
import { INBOUND_VISIBLE_TONG_TYPE_WHERE } from "@/lib/constants/tong-type-scope";

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

export interface PickupLocationStockSummary {
  location: (typeof PICKUP_CRATE_STOCK_LOCATIONS)[number];
  title: string;
  shipperId: string;
  shipperName: string;
  quantities: Record<string, number>;
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
  const crateTypes = await prisma.tongType.findMany({
    where: { ...INBOUND_VISIBLE_TONG_TYPE_WHERE, trackInventory: true, isBox: false },
    select: { id: true, code: true, name: true },
  });
  const order = new Map(
    sortTongColumnCodes(crateTypes.map((crateType) => crateType.code)).map(
      (code, index) => [code, index]
    )
  );
  return crateTypes.sort(
    (a, b) => (order.get(a.code) ?? 999) - (order.get(b.code) ?? 999)
  );
}

async function getPickupLocationStockSummaries(
  crateTypes: CrateTypeColumn[]
): Promise<PickupLocationStockSummary[]> {
  const poolShippers = await ensureLocationPoolShippersForStock();
  const poolByLocation = new Map<
    (typeof PICKUP_CRATE_STOCK_LOCATIONS)[number],
    { id: string; name: string }
  >();

  for (const shipper of poolShippers) {
    const location = stockLocationForPoolShipperCode(shipper.code);
    if (location) {
      poolByLocation.set(location, { id: shipper.id, name: shipper.name });
    }
  }

  const poolShipperIds = poolShippers.map((shipper) => shipper.id);
  const stockRows =
    poolShipperIds.length === 0
      ? []
      : await prisma.customerCrateStock.findMany({
          where: {
            shipperId: { in: poolShipperIds },
            location: { in: [...PICKUP_CRATE_STOCK_LOCATIONS] },
          },
          select: {
            shipperId: true,
            crateTypeId: true,
            location: true,
            quantity: true,
          },
        });

  return PICKUP_CRATE_STOCK_LOCATIONS.map((location) => {
    const pool = poolByLocation.get(location);
    const quantities = initQuantities(crateTypes);

    for (const row of stockRows) {
      if (row.location !== location) continue;
      if (pool && row.shipperId !== pool.id) continue;
      quantities[row.crateTypeId] =
        (quantities[row.crateTypeId] ?? 0) + row.quantity;
    }

    return {
      location,
      title: formatPickupLocationLabel(location),
      shipperId: pool?.id ?? "",
      shipperName: pool?.name ?? formatPickupLocationLabel(location),
      quantities,
    };
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
  await requireWrite();
  const crateTypes = await getTrackedCrateTypes();
  const pickupLocationSummaries =
    await getPickupLocationStockSummaries(crateTypes);

  const shippers = await prisma.shipper.findMany({
    where: {
      ...CUSTOMER_CRATE_STOCK_LIST_SHIPPER_WHERE,
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

  return { crateTypes, rows, pickupLocationSummaries };
}

export async function updateCustomerCrateStock(
  shipperId: string,
  crateTypeId: string,
  quantity: number,
  location: string,
  notes?: string
) {
  const shipper = await prisma.shipper.findUnique({
    where: { id: shipperId },
    select: { shipperKind: true },
  });
  if (!shipper) {
    throw new Error("寄货人不存在 Shipper not found");
  }
  if (shipper.shipperKind === SHIPPER_KIND.CRATE_STOCK_AGENT) {
    await requireCrateStockAgentAdmin();
  } else {
    await requireCustomerCrateStockEdit();
  }

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
  await requireWrite();
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

interface CrateStockChange {
  crateTypeId: string;
  quantity: number;
}

async function addCustomerCratesBatchInTx(
  tx: Prisma.TransactionClient,
  shipperId: string,
  items: CrateStockChange[],
  changeType: string,
  location: string,
  notes?: string
) {
  const additions = items.filter((item) => item.quantity > 0);
  if (additions.length === 0) return;

  const loc = normalizeLocation(location);
  const note = notes?.trim() || null;
  const crateTypeIds = additions.map((item) => item.crateTypeId);

  const existing = await tx.customerCrateStock.findMany({
    where: {
      shipperId,
      location: loc,
      crateTypeId: { in: crateTypeIds },
    },
    select: { crateTypeId: true, quantity: true },
  });
  const stockByType = new Map(
    existing.map((row) => [row.crateTypeId, row.quantity])
  );

  const ledgerEntries: Prisma.CustomerCrateLedgerCreateManyInput[] = [];

  for (const { crateTypeId, quantity } of additions) {
    const previousQty = stockByType.get(crateTypeId) ?? 0;
    const newQty = previousQty + quantity;

    await tx.customerCrateStock.upsert({
      where: stockWhere(shipperId, crateTypeId, loc),
      create: { shipperId, crateTypeId, location: loc, quantity: newQty },
      update: { quantity: newQty },
    });

    ledgerEntries.push({
      shipperId,
      crateTypeId,
      location: loc,
      changeType,
      quantity,
      balance: newQty,
      notes: note,
    });
  }

  await tx.customerCrateLedger.createMany({ data: ledgerEntries });
}

/** Batch increase customer crate stock in a single transaction. */
export async function addCustomerCratesBatch(
  shipperId: string,
  items: CrateStockChange[],
  changeType: string,
  location: string,
  notes?: string,
  tx?: Prisma.TransactionClient
) {
  await requireWrite();

  if (tx) {
    await addCustomerCratesBatchInTx(
      tx,
      shipperId,
      items,
      changeType,
      location,
      notes
    );
    return;
  }

  await prisma.$transaction(async (innerTx) => {
    await addCustomerCratesBatchInTx(
      innerTx,
      shipperId,
      items,
      changeType,
      location,
      notes
    );
  });
}

async function deductCustomerCratesBatchInTx(
  tx: Prisma.TransactionClient,
  shipperId: string,
  items: CrateStockChange[],
  changeType: string,
  location: string,
  notes?: string
) {
  const deductions = items.filter((item) => item.quantity > 0);
  if (deductions.length === 0) return;

  const loc = normalizeLocation(location);
  const note = notes?.trim() || null;
  const crateTypeIds = deductions.map((item) => item.crateTypeId);

  const existing = await tx.customerCrateStock.findMany({
    where: {
      shipperId,
      location: loc,
      crateTypeId: { in: crateTypeIds },
    },
    select: { crateTypeId: true, quantity: true },
  });
  const stockByType = new Map(
    existing.map((row) => [row.crateTypeId, row.quantity])
  );

  const ledgerEntries: Prisma.CustomerCrateLedgerCreateManyInput[] = [];

  for (const { crateTypeId, quantity } of deductions) {
    const previousQty = stockByType.get(crateTypeId) ?? 0;
    const newQty = previousQty - quantity;

    await tx.customerCrateStock.upsert({
      where: stockWhere(shipperId, crateTypeId, loc),
      create: { shipperId, crateTypeId, location: loc, quantity: -quantity },
      update: { quantity: newQty },
    });

    ledgerEntries.push({
      shipperId,
      crateTypeId,
      location: loc,
      changeType,
      quantity: -quantity,
      balance: newQty,
      notes: note,
    });
  }

  await tx.customerCrateLedger.createMany({ data: ledgerEntries });
}

/** Batch decrease customer crate stock in a single transaction. */
export async function deductCustomerCratesBatch(
  shipperId: string,
  items: CrateStockChange[],
  changeType: string,
  location: string,
  notes?: string,
  tx?: Prisma.TransactionClient
) {
  await requireWrite();

  if (tx) {
    await deductCustomerCratesBatchInTx(
      tx,
      shipperId,
      items,
      changeType,
      location,
      notes
    );
    return;
  }

  await prisma.$transaction(async (innerTx) => {
    await deductCustomerCratesBatchInTx(
      innerTx,
      shipperId,
      items,
      changeType,
      location,
      notes
    );
  });
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

  await addCustomerCratesBatch(
    shipperId,
    [{ crateTypeId, quantity }],
    changeType,
    location,
    notes
  );
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

  await deductCustomerCratesBatch(
    shipperId,
    [{ crateTypeId, quantity }],
    changeType,
    location,
    notes
  );
}
