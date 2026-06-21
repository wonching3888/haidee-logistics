"use server";

import { prisma } from "@/lib/prisma";
import {
  DEPOT_GROUPS,
  emptyDepotQty,
  marketToDepotLabel,
} from "@/lib/constants/depot-groups";
import { resolveActiveDepotLabels } from "@/lib/daily-dispatch-summary";
import {
  formatDisplayDate,
  parseDateInput,
  toDateInputValue,
} from "@/lib/inbound-utils";

export interface DepotQty {
  crate: number;
  box: number;
}

export interface DailyDispatchSummaryRow {
  lorryNo: string;
  depots: Record<string, DepotQty>;
  total: DepotQty;
}

export interface DailyDispatchSummaryData {
  date: string;
  dateInput: string;
  activeDepots: string[];
  rows: DailyDispatchSummaryRow[];
  columnTotals: Record<string, DepotQty>;
  grandTotal: DepotQty;
}

export interface DashboardOrder {
  id: string;
  dispatchNo: string | null;
  date: string;
  truckPlate: string;
  driverName: string | null;
  markets: string[];
  totalQty: number;
}

export interface DashboardData {
  dateInput: string;
  dateStr: string;
  stats: {
    todayInbound: number;
    unassigned: number;
    dispatchCount: number;
  };
  dailySummary: DailyDispatchSummaryData;
  dispatchOrders: DashboardOrder[];
}

function addLineQty(
  qty: DepotQty,
  quantity: number,
  isBox: boolean
): DepotQty {
  if (isBox) return { ...qty, box: qty.box + quantity };
  return { ...qty, crate: qty.crate + quantity };
}

function hasDepotQty(qty: DepotQty): boolean {
  return qty.crate > 0 || qty.box > 0;
}

function sumDepotQty(a: DepotQty, b: DepotQty): DepotQty {
  return { crate: a.crate + b.crate, box: a.box + b.box };
}

export async function getDailyDispatchSummary(
  dateStr?: string
): Promise<DailyDispatchSummaryData> {
  const date = parseDateInput(dateStr ?? toDateInputValue(new Date()));

  const orders = await prisma.dispatchOrder.findMany({
    where: {
      date,
      status: { notIn: ["draft", "cancelled"] },
      lines: { some: {} },
    },
    include: {
      truck: { select: { plate: true } },
      lines: {
        include: {
          inboundLine: {
            include: { stall: { include: { market: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const rowMap = new Map<string, DailyDispatchSummaryRow>();
  const rowSortMeta = new Map<
    string,
    { tier: number; firstCreatedAtMs: number }
  >();

  function wtlRowTier(row: DailyDispatchSummaryRow): number {
    const klQty = row.depots.KL ?? { crate: 0, box: 0 };
    const mcQty = row.depots.MC ?? { crate: 0, box: 0 };
    if (hasDepotQty(klQty)) return 0;
    if (hasDepotQty(mcQty)) return 1;
    return 2;
  }

  for (const order of orders) {
    const lorryNo = order.truck.plate;
    const createdAtMs = order.createdAt.getTime();
    let row = rowMap.get(lorryNo);
    if (!row) {
      row = {
        lorryNo,
        depots: emptyDepotQty(),
        total: { crate: 0, box: 0 },
      };
      rowMap.set(lorryNo, row);
      rowSortMeta.set(lorryNo, { tier: 2, firstCreatedAtMs: createdAtMs });
    } else {
      const meta = rowSortMeta.get(lorryNo)!;
      meta.firstCreatedAtMs = Math.min(meta.firstCreatedAtMs, createdAtMs);
    }

    for (const dl of order.lines) {
      const line = dl.inboundLine;
      const marketCode = line.stall.market?.code;
      if (!marketCode) continue;

      const depotLabel = marketToDepotLabel(marketCode);
      const cell = row.depots[depotLabel] ?? { crate: 0, box: 0 };
      row.depots[depotLabel] = addLineQty(cell, line.quantity, line.isBox);
      row.total = addLineQty(row.total, line.quantity, line.isBox);
    }

    const meta = rowSortMeta.get(lorryNo)!;
    meta.tier = wtlRowTier(row);
  }

  const rows = Array.from(rowMap.values()).sort((a, b) => {
    const metaA = rowSortMeta.get(a.lorryNo)!;
    const metaB = rowSortMeta.get(b.lorryNo)!;
    if (metaA.tier !== metaB.tier) return metaA.tier - metaB.tier;
    return metaA.firstCreatedAtMs - metaB.firstCreatedAtMs;
  });

  const columnTotals = emptyDepotQty();
  let grandTotal: DepotQty = { crate: 0, box: 0 };

  for (const row of rows) {
    for (const group of DEPOT_GROUPS) {
      const cell = row.depots[group.label] ?? { crate: 0, box: 0 };
      columnTotals[group.label] = sumDepotQty(
        columnTotals[group.label] ?? { crate: 0, box: 0 },
        cell
      );
    }
    grandTotal = sumDepotQty(grandTotal, row.total);
  }

  const activeDepots = resolveActiveDepotLabels(columnTotals);

  return {
    date: formatDisplayDate(date),
    dateInput: toDateInputValue(date),
    activeDepots,
    rows,
    columnTotals,
    grandTotal,
  };
}

export async function getDashboardData(dateStr?: string): Promise<DashboardData> {
  const date = parseDateInput(dateStr ?? toDateInputValue(new Date()));
  const dateInput = toDateInputValue(date);

  const [inboundLines, unassignedLines, dispatchOrders, dailySummary] =
    await Promise.all([
      prisma.inboundLine.findMany({
        where: {
          session: { date, status: "confirmed" },
          isBox: false,
        },
        select: { quantity: true },
      }),
      prisma.inboundLine.findMany({
        where: {
          dispatchStatus: "unassigned",
          session: { date, status: "confirmed" },
          isBox: false,
        },
        select: { quantity: true },
      }),
      prisma.dispatchOrder.findMany({
        where: {
          date,
          status: { notIn: ["draft", "cancelled"] },
        },
        include: {
          truck: { select: { plate: true } },
          lines: {
            include: {
              inboundLine: { select: { quantity: true, isBox: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      getDailyDispatchSummary(dateInput),
    ]);

  const todayInbound = inboundLines.reduce((s, l) => s + l.quantity, 0);
  const unassigned = unassignedLines.reduce((s, l) => s + l.quantity, 0);

  const dispatchOrdersList: DashboardOrder[] = dispatchOrders.map((o) => ({
    id: o.id,
    dispatchNo: o.dispatchNo,
    date: formatDisplayDate(o.date),
    truckPlate: o.truck.plate,
    driverName: o.driverName,
    markets: o.markets,
    totalQty: o.lines.reduce((s, l) => {
      const line = l.inboundLine;
      if (!line || line.isBox) return s;
      return s + line.quantity;
    }, 0),
  }));

  return {
    dateInput,
    dateStr: formatDisplayDate(date),
    stats: {
      todayInbound,
      unassigned,
      dispatchCount: dispatchOrders.length,
    },
    dailySummary,
    dispatchOrders: dispatchOrdersList,
  };
}
