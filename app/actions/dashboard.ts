"use server";

import { prisma } from "@/lib/prisma";
import {
  formatDisplayDate,
  parseDateInput,
  toDateInputValue,
} from "@/lib/inbound-utils";
import { getSadaoStockByTongType } from "@/lib/tong";

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

  return {
    todayStr: formatDisplayDate(today),
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
