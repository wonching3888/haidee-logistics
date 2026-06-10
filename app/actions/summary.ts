"use server";

import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/inbound-utils";

export interface LoadingMatrixTruck {
  orderId: string;
  truckPlate: string;
  capacity: number | null;
  markets: string[];
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
  indent: boolean;
  isGroupHeader: boolean;
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

interface SessionAccum {
  sessionId: string;
  shipperId: string;
  shipperName: string;
  areaNote: string | null;
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

export async function getDailySummary(
  dateStr: string
): Promise<VehicleLoadingListData> {
  const date = parseDateInput(dateStr);

  const orders = await prisma.dispatchOrder.findMany({
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

  if (orders.length === 0) {
    return {
      trucks: [],
      columns: [],
      rows: [],
      columnCrateTotals: {},
      hasDispatches: false,
    };
  }

  const trucks: LoadingMatrixTruck[] = orders.map((order) => ({
    orderId: order.id,
    truckPlate: order.truck.plate,
    capacity: order.truck.capacityTong,
    markets: order.markets,
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

  const sessionMap = new Map<string, SessionAccum>();

  for (const order of orders) {
    const orderMarkets = new Set(order.markets);

    for (const dl of order.lines) {
      const line = dl.inboundLine;
      const marketCode = line.stall.market?.code;
      if (!marketCode || !orderMarkets.has(marketCode)) continue;

      const session = line.session;
      const sessionId = session.id;
      const key = matrixCellKey(order.id, marketCode);

      let accum = sessionMap.get(sessionId);
      if (!accum) {
        accum = {
          sessionId,
          shipperId: session.shipperId,
          shipperName: session.shipper.name,
          areaNote: session.areaNote,
          cells: {},
        };
        sessionMap.set(sessionId, accum);
      }

      addToCell(accum.cells, key, line.quantity, line.isBox);
    }
  }

  const byShipper = new Map<string, SessionAccum[]>();
  for (const session of Array.from(sessionMap.values())) {
    const list = byShipper.get(session.shipperId) ?? [];
    list.push(session);
    byShipper.set(session.shipperId, list);
  }

  const rows: LoadingMatrixRow[] = [];

  const shipperGroups = Array.from(byShipper.entries()).sort((a, b) => {
    const nameA = a[1][0]?.shipperName ?? "";
    const nameB = b[1][0]?.shipperName ?? "";
    return nameA.localeCompare(nameB);
  });

  for (const [, sessions] of shipperGroups) {
    const shipperName = sessions[0].shipperName;
    const withArea = sessions
      .filter((s) => s.areaNote?.trim())
      .sort((a, b) => (a.areaNote ?? "").localeCompare(b.areaNote ?? ""));
    const withoutArea = sessions.filter((s) => !s.areaNote?.trim());

    for (const session of withoutArea) {
      rows.push({
        id: session.sessionId,
        label: shipperName,
        indent: false,
        isGroupHeader: false,
        cells: session.cells,
      });
    }

    if (withArea.length > 0) {
      rows.push({
        id: `header-${sessions[0].shipperId}`,
        label: shipperName,
        indent: false,
        isGroupHeader: true,
        cells: {},
      });

      for (const session of withArea) {
        rows.push({
          id: session.sessionId,
          label: session.areaNote!.trim(),
          indent: true,
          isGroupHeader: false,
          cells: session.cells,
        });
      }
    }
  }

  const columnCrateTotals: Record<string, number> = {};
  for (const col of columns) {
    columnCrateTotals[col.key] = 0;
  }

  for (const row of rows) {
    if (row.isGroupHeader) continue;
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
