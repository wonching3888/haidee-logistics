"use server";

import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/inbound-utils";
import { DISPATCH_MARKET_ORDER } from "@/lib/markets";

export interface StallSearchResult {
  stallCode: string;
  marketCode: string;
  shipperName: string;
  vehicle: string;
  quantity: number;
  status: string;
}

export interface SummaryColumn {
  id: string;
  truckPlate: string;
  marketCode: string;
  capacity: number | null;
}

export interface SummaryRow {
  sessionId: string;
  label: string;
  cells: Record<string, number>;
  total: number;
}

export interface DailySummaryData {
  columns: SummaryColumn[];
  rows: SummaryRow[];
  columnTotals: Record<string, number>;
  grandTotal: number;
}

export async function searchStallByCode(
  dateStr: string,
  query: string
): Promise<StallSearchResult[]> {
  if (!query.trim()) return [];

  const date = parseDateInput(dateStr);
  const lines = await prisma.inboundLine.findMany({
    where: {
      session: { date, status: "confirmed" },
      stall: { code: { contains: query.trim(), mode: "insensitive" } },
    },
    include: {
      session: {
        include: {
          shipper: true,
          lines: false,
        },
      },
      stall: { include: { market: true } },
      dispatchLines: {
        include: {
          dispatchOrder: { include: { truck: true } },
        },
      },
    },
  });

  return lines.map((l) => {
    const assigned = l.dispatchStatus === "assigned";
    const dispatch = l.dispatchLines[0]?.dispatchOrder;
    return {
      stallCode: l.stall.code,
      marketCode: l.stall.market?.code ?? "—",
      shipperName: l.session.shipper.name,
      vehicle: assigned
        ? `${dispatch?.truck.plate ?? ""} ${dispatch?.markets.join(" ") ?? ""}`.trim()
        : "未分配",
      quantity: l.quantity,
      status: assigned ? "已分配" : "未分配",
    };
  });
}

function buildSessionLabel(
  shipperName: string,
  areaNote: string | null | undefined
): string {
  if (areaNote?.trim()) {
    return `${shipperName} (${areaNote.trim()})`;
  }
  return shipperName;
}

export async function getDailySummary(dateStr: string): Promise<DailySummaryData> {
  const date = parseDateInput(dateStr);

  const orders = await prisma.dispatchOrder.findMany({
    where: { date },
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

  const columns: SummaryColumn[] = [];
  for (const order of orders) {
    for (const marketCode of order.markets) {
      columns.push({
        id: `${order.id}:${marketCode}`,
        truckPlate: order.truck.plate,
        marketCode,
        capacity: order.truck.capacityTong,
      });
    }
  }

  const visibleMarkets = DISPATCH_MARKET_ORDER.filter((m) =>
    columns.some((c) => c.marketCode === m)
  );

  const filteredColumns = columns.filter((c) =>
    visibleMarkets.includes(c.marketCode as (typeof DISPATCH_MARKET_ORDER)[number])
  );

  const sessions = await prisma.inboundSession.findMany({
    where: { date, status: "confirmed" },
    include: {
      shipper: true,
      lines: {
        include: {
          stall: { include: { market: true } },
          dispatchLines: {
            include: {
              dispatchOrder: true,
            },
          },
        },
      },
    },
    orderBy: [{ shipper: { name: "asc" } }, { createdAt: "asc" }],
  });

  const rows: SummaryRow[] = [];
  const columnTotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const session of sessions) {
    const cells: Record<string, number> = {};
    let total = 0;

    for (const line of session.lines) {
      if (line.dispatchStatus !== "assigned") continue;

      const marketCode = line.stall.market?.code;
      if (!marketCode) continue;

      for (const dl of line.dispatchLines) {
        const order = dl.dispatchOrder;
        const colId = `${order.id}:${marketCode}`;
        if (!filteredColumns.some((c) => c.id === colId)) continue;

        cells[colId] = (cells[colId] ?? 0) + line.quantity;
        columnTotals[colId] = (columnTotals[colId] ?? 0) + line.quantity;
        total += line.quantity;
        grandTotal += line.quantity;
      }
    }

    if (total === 0) continue;

    rows.push({
      sessionId: session.id,
      label: buildSessionLabel(session.shipper.name, session.areaNote),
      cells,
      total,
    });
  }

  return {
    columns: filteredColumns,
    rows,
    columnTotals,
    grandTotal,
  };
}
