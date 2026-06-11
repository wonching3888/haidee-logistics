"use server";

import { prisma } from "@/lib/prisma";
import {
  DEPOT_GROUPS,
  emptyDepotQty,
  marketToDepotLabel,
} from "@/lib/constants/depot-groups";
import {
  formatDisplayDate,
  parseDateInput,
  toDateInputValue,
} from "@/lib/inbound-utils";
import { getSadaoStockByTongType } from "@/lib/tong";

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

  for (const order of orders) {
    const lorryNo = order.truck.plate;
    let row = rowMap.get(lorryNo);
    if (!row) {
      row = {
        lorryNo,
        depots: emptyDepotQty(),
        total: { crate: 0, box: 0 },
      };
      rowMap.set(lorryNo, row);
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
  }

  const rows = Array.from(rowMap.values()).sort((a, b) =>
    a.lorryNo.localeCompare(b.lorryNo)
  );

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

  const activeDepots = DEPOT_GROUPS.filter((group) => {
    if (group.label !== "OTHERS") return true;
    return hasDepotQty(columnTotals[group.label] ?? { crate: 0, box: 0 });
  }).map((group) => group.label);

  return {
    date: formatDisplayDate(date),
    dateInput: toDateInputValue(date),
    activeDepots,
    rows,
    columnTotals,
    grandTotal,
  };
}

export async function getDashboardData() {
  const today = parseDateInput(toDateInputValue(new Date()));

  const [
    inboundLines,
    allUnassignedLines,
    dispatchCount,
    stock,
    marketLines,
    recentOrders,
  ] = await Promise.all([
    prisma.inboundLine.findMany({
      where: { session: { date: today, status: "confirmed" } },
      select: { quantity: true },
    }),
    prisma.inboundLine.findMany({
      where: {
        dispatchStatus: "unassigned",
        session: { status: "confirmed" },
      },
      select: { quantity: true, session: { select: { date: true } } },
    }),
    prisma.dispatchOrder.count({ where: { date: today } }),
    getSadaoStockByTongType(),
    prisma.inboundLine.findMany({
      where: { session: { date: today, status: "confirmed" } },
      include: { stall: { include: { market: true } } },
    }),
    prisma.dispatchOrder.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        truck: { select: { plate: true, capacityTong: true } },
        lines: { include: { inboundLine: { select: { quantity: true } } } },
      },
    }),
  ]);

  const todayInbound = inboundLines.reduce((s, l) => s + l.quantity, 0);
  const unassigned = allUnassignedLines.reduce((s, l) => s + l.quantity, 0);
  const olderUnassigned = allUnassignedLines
    .filter((l) => l.session.date < today)
    .reduce((s, l) => s + l.quantity, 0);

  const totalSadaoStock = Object.values(stock).reduce((s, r) => s + r.stock, 0);

  const marketTotals: Record<string, number> = {};
  for (const line of marketLines) {
    const code = line.stall.market?.code;
    if (code) {
      marketTotals[code] = (marketTotals[code] ?? 0) + line.quantity;
    }
  }

  const dailySummary = await getDailyDispatchSummary(toDateInputValue(today));

  return {
    todayStr: formatDisplayDate(today),
    dailySummary,
    stats: {
      todayInbound,
      unassigned,
      dispatchCount,
      totalSadaoStock,
    },
    unassignedWarning:
      olderUnassigned > 0
        ? { total: unassigned, olderThanToday: olderUnassigned }
        : null,
    marketTotals,
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      dispatchNo: o.dispatchNo,
      date: formatDisplayDate(o.date),
      truckPlate: o.truck.plate,
      driverName: o.driverName,
      markets: o.markets,
      status: o.status,
      totalQty: o.lines.reduce(
        (s, l) => s + (l.inboundLine?.quantity ?? 0),
        0
      ),
      capacity: o.truck.capacityTong,
    })),
  };
}
