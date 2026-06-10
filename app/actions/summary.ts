"use server";

import { prisma } from "@/lib/prisma";
import { buildConsignorAreaLabel } from "@/lib/consignor-label";
import { parseDateInput } from "@/lib/inbound-utils";

export interface LoadingListColumn {
  id: string;
  truckPlate: string;
  capacity: number | null;
}

export interface LoadingListRow {
  sessionId: string;
  label: string;
  cells: Record<string, number>;
  boxCells: Record<string, number>;
  boxTotal: number;
  total: number;
}

export interface VehicleLoadingListData {
  columns: LoadingListColumn[];
  rows: LoadingListRow[];
  columnTotals: Record<string, number>;
  columnBoxTotals: Record<string, number>;
  boxGrandTotal: number;
  grandTotal: number;
  hasDispatches: boolean;
}

/** @deprecated Use VehicleLoadingListData */
export type DailySummaryData = VehicleLoadingListData;

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
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (orders.length === 0) {
    return {
      columns: [],
      rows: [],
      columnTotals: {},
      columnBoxTotals: {},
      boxGrandTotal: 0,
      grandTotal: 0,
      hasDispatches: false,
    };
  }

  const columns: LoadingListColumn[] = orders.map((order) => ({
    id: order.id,
    truckPlate: order.truck.plate,
    capacity: order.truck.capacityTong,
  }));

  const rowMap = new Map<string, LoadingListRow>();

  for (const order of orders) {
    for (const dl of order.lines) {
      const line = dl.inboundLine;
      const session = line.session;
      const sessionId = session.id;

      let row = rowMap.get(sessionId);
      if (!row) {
        row = {
          sessionId,
          label: buildConsignorAreaLabel(
            session.shipper.name,
            session.areaNote
          ),
          cells: {},
          boxCells: {},
          boxTotal: 0,
          total: 0,
        };
        rowMap.set(sessionId, row);
      }

      if (line.isBox) {
        row.boxCells[order.id] = (row.boxCells[order.id] ?? 0) + line.quantity;
      } else {
        row.cells[order.id] = (row.cells[order.id] ?? 0) + line.quantity;
      }
    }
  }

  const rows = Array.from(rowMap.values())
    .map((row) => ({
      ...row,
      boxTotal: Object.values(row.boxCells).reduce((sum, qty) => sum + qty, 0),
      total: Object.values(row.cells).reduce((sum, qty) => sum + qty, 0),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const columnTotals: Record<string, number> = {};
  const columnBoxTotals: Record<string, number> = {};
  for (const col of columns) {
    columnTotals[col.id] = rows.reduce(
      (sum, row) => sum + (row.cells[col.id] ?? 0),
      0
    );
    columnBoxTotals[col.id] = rows.reduce(
      (sum, row) => sum + (row.boxCells[col.id] ?? 0),
      0
    );
  }

  const grandTotal = Object.values(columnTotals).reduce(
    (sum, qty) => sum + qty,
    0
  );
  const boxGrandTotal = rows.reduce((sum, row) => sum + row.boxTotal, 0);

  return {
    columns,
    rows,
    columnTotals,
    columnBoxTotals,
    boxGrandTotal,
    grandTotal,
    hasDispatches: true,
  };
}
