"use server";

import { prisma } from "@/lib/prisma";
import { MARKET_ORDER } from "@/lib/constants";
import { parseDateInput } from "@/lib/inbound-utils";
import {
  formatLoadingListDisplayName,
  formatLoadingListRowLabel,
} from "@/lib/consignor-label";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";

export interface LoadingMatrixTruck {
  orderId: string;
  truckPlate: string;
  capacity: number | null;
  markets: string[];
  dispatchedAt: Date;
}

export interface LoadingMatrixColumn {
  key: string;
  orderId: string;
  truckPlate: string;
  marketCode: string;
  capacity: number | null;
  showCapacity: boolean;
}

export interface LoadingMatrixCell {
  crateQty: number;
  boxQty: number;
}

export interface LoadingMatrixRow {
  id: string;
  label: string;
  displayName: string;
  cells: Record<string, LoadingMatrixCell>;
}

export interface VehicleLoadingListData {
  trucks: LoadingMatrixTruck[];
  columns: LoadingMatrixColumn[];
  rows: LoadingMatrixRow[];
  columnCrateTotals: Record<string, number>;
  hasDispatches: boolean;
}

/** @deprecated Use VehicleLoadingListData */
export type DailySummaryData = VehicleLoadingListData;

function matrixCellKey(orderId: string, marketCode: string): string {
  return `${orderId}:${marketCode}`;
}

interface RowAccum {
  shipperId: string;
  shipperName: string;
  areaNote: string | null;
  pickupLocation: string;
  cells: Record<string, LoadingMatrixCell>;
}

function emptyCell(): LoadingMatrixCell {
  return { crateQty: 0, boxQty: 0 };
}

function addToCell(
  cells: Record<string, LoadingMatrixCell>,
  key: string,
  quantity: number,
  isBox: boolean
) {
  if (!cells[key]) cells[key] = emptyCell();
  if (isBox) cells[key].boxQty += quantity;
  else cells[key].crateQty += quantity;
}

function marketRank(code: string): number {
  const idx = MARKET_ORDER.indexOf(code as (typeof MARKET_ORDER)[number]);
  return idx === -1 ? 999 : idx;
}

function sortMarketCodes(codes: string[]): string[] {
  return [...codes].sort((a, b) => marketRank(a) - marketRank(b));
}

type DispatchOrderWithLines = Awaited<
  ReturnType<typeof fetchDispatchOrders>
>[number];

async function fetchDispatchOrders(date: Date) {
  return prisma.dispatchOrder.findMany({
    where: {
      date,
      status: { notIn: ["draft", "cancelled"] },
      lines: { some: {} },
    },
    include: {
      truck: true,
      lines: {
        include: {
          inboundLine: {
            include: {
              session: { include: { shipper: true } },
              stall: { include: { market: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

function getTruckPrimaryMarket(order: DispatchOrderWithLines): string {
  const orderMarkets = new Set(order.markets);
  const marketCrates = new Map<string, number>();

  for (const dl of order.lines) {
    const line = dl.inboundLine;
    const marketCode = line.stall.market?.code;
    if (!marketCode || !orderMarkets.has(marketCode) || line.isBox) continue;
    marketCrates.set(
      marketCode,
      (marketCrates.get(marketCode) ?? 0) + line.quantity
    );
  }

  let bestMarket = order.markets[0] ?? "KL";
  let bestQty = -1;
  for (const [code, qty] of Array.from(marketCrates.entries())) {
    if (qty > bestQty) {
      bestQty = qty;
      bestMarket = code;
    }
  }

  if (bestQty <= 0) {
    for (const m of MARKET_ORDER) {
      if (order.markets.includes(m)) return m;
    }
  }

  return bestMarket;
}

function sortDispatchOrders(
  orders: DispatchOrderWithLines[]
): DispatchOrderWithLines[] {
  return [...orders].sort((a, b) => {
    const aMarket = getTruckPrimaryMarket(a);
    const bMarket = getTruckPrimaryMarket(b);
    const aOrder = marketRank(aMarket);
    const bOrder = marketRank(bMarket);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

function rowGroupKey(
  shipperId: string,
  areaNote: string | null,
  pickupLocation: string
): string {
  return `${shipperId}:${(areaNote ?? "").trim()}:${pickupLocation}`;
}

export async function getDailySummary(
  dateStr: string
): Promise<VehicleLoadingListData> {
  const date = parseDateInput(dateStr);

  const orders = await fetchDispatchOrders(date);

  if (orders.length === 0) {
    return {
      trucks: [],
      columns: [],
      rows: [],
      columnCrateTotals: {},
      hasDispatches: false,
    };
  }

  const sortedOrders = sortDispatchOrders(orders);

  const trucks: LoadingMatrixTruck[] = sortedOrders.map((order) => ({
    orderId: order.id,
    truckPlate: order.truck.plate,
    capacity: order.truck.capacityTong,
    markets: sortMarketCodes(order.markets),
    dispatchedAt: order.createdAt,
  }));

  const columns: LoadingMatrixColumn[] = [];
  for (const truck of trucks) {
    truck.markets.forEach((marketCode, index) => {
      columns.push({
        key: matrixCellKey(truck.orderId, marketCode),
        orderId: truck.orderId,
        truckPlate: truck.truckPlate,
        marketCode,
        capacity: truck.capacity,
        showCapacity: index === 0,
      });
    });
  }

  const rowMap = new Map<string, RowAccum>();

  for (const order of sortedOrders) {
    const orderMarkets = new Set(order.markets);

    for (const dl of order.lines) {
      const line = dl.inboundLine;
      const marketCode = line.stall.market?.code;
      if (!marketCode || !orderMarkets.has(marketCode)) continue;

      const session = line.session;
      const pickupLocation = resolveSessionPickupLocation(
        session.pickupLocation,
        session.shipper.pickupLocation
      );
      const groupKey = rowGroupKey(
        session.shipperId,
        session.areaNote,
        pickupLocation
      );
      const cellKey = matrixCellKey(order.id, marketCode);

      let row = rowMap.get(groupKey);
      if (!row) {
        row = {
          shipperId: session.shipperId,
          shipperName: session.shipper.name,
          areaNote: session.areaNote,
          pickupLocation,
          cells: {},
        };
        rowMap.set(groupKey, row);
      }

      addToCell(row.cells, cellKey, line.quantity, line.isBox);
    }
  }

  const rows: LoadingMatrixRow[] = Array.from(rowMap.values())
    .sort((a, b) => {
      const nameCmp = a.shipperName.localeCompare(b.shipperName);
      if (nameCmp !== 0) return nameCmp;
      const areaCmp = (a.areaNote ?? "").localeCompare(b.areaNote ?? "");
      if (areaCmp !== 0) return areaCmp;
      return a.pickupLocation.localeCompare(b.pickupLocation);
    })
    .map((row) => ({
      id: rowGroupKey(row.shipperId, row.areaNote, row.pickupLocation),
      label: formatLoadingListRowLabel(
        row.shipperName,
        row.areaNote,
        row.pickupLocation
      ),
      displayName: formatLoadingListDisplayName(row.shipperName, row.areaNote),
      cells: row.cells,
    }));

  const columnCrateTotals: Record<string, number> = {};
  for (const col of columns) {
    columnCrateTotals[col.key] = 0;
  }

  for (const row of rows) {
    for (const col of columns) {
      const cell = row.cells[col.key];
      if (cell) {
        columnCrateTotals[col.key] =
          (columnCrateTotals[col.key] ?? 0) + cell.crateQty;
      }
    }
  }

  return {
    trucks,
    columns,
    rows,
    columnCrateTotals,
    hasDispatches: true,
  };
}
