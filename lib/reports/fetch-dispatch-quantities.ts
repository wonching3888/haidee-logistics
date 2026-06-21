import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/date-utils";
import { decimalToNumber } from "@/lib/freight-rates";
import { OTHER_MARKET_CODE } from "@/lib/markets";

export interface DispatchQuantityEntry {
  dateKey: string;
  monthKey: string;
  columnCode: string;
  quantity: number;
}

function monthKeyFromDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function charterTripHasRevenue(trip: {
  charterRevenueMyr: unknown;
  extraItems: Array<{ amountMyr: unknown }>;
}): boolean {
  let revenueMyr = decimalToNumber(trip.charterRevenueMyr) ?? 0;
  for (const item of trip.extraItems) {
    revenueMyr += decimalToNumber(item.amountMyr) ?? 0;
  }
  return Math.round(revenueMyr * 100) / 100 > 0;
}

async function loadRevenueCharterTrips(start: Date, end: Date) {
  return prisma.charterTrip.findMany({
    where: { date: { gte: start, lte: end } },
    select: {
      date: true,
      charterRevenueMyr: true,
      extraItems: {
        where: { itemType: "revenue" },
        select: { amountMyr: true },
      },
      lines: {
        select: {
          quantity: true,
          tongType: { select: { code: true } },
        },
      },
    },
  });
}

/** Charter barrel lines folded into crate columns (Plan B). Revenue > 0 only. */
export async function fetchCharterCrateEntries(
  start: Date,
  end: Date,
  mapColumnCode: (tongCode: string) => string
): Promise<DispatchQuantityEntry[]> {
  const trips = await loadRevenueCharterTrips(start, end);
  const entries: DispatchQuantityEntry[] = [];

  for (const trip of trips) {
    if (!charterTripHasRevenue(trip)) continue;

    const dateKey = toDateInputValue(trip.date);
    const monthKey = monthKeyFromDate(trip.date);

    for (const line of trip.lines) {
      if (line.quantity <= 0) continue;
      entries.push({
        dateKey,
        monthKey,
        columnCode: mapColumnCode(line.tongType.code),
        quantity: line.quantity,
      });
    }
  }

  return entries;
}

/** Charter barrels attributed to OTHER market (Plan B). Revenue > 0 only. */
export async function fetchCharterMarketEntries(
  start: Date,
  end: Date
): Promise<DispatchQuantityEntry[]> {
  const trips = await loadRevenueCharterTrips(start, end);
  const entries: DispatchQuantityEntry[] = [];

  for (const trip of trips) {
    if (!charterTripHasRevenue(trip)) continue;

    const qty = trip.lines.reduce((sum, line) => sum + line.quantity, 0);
    if (qty <= 0) continue;

    entries.push({
      dateKey: toDateInputValue(trip.date),
      monthKey: monthKeyFromDate(trip.date),
      columnCode: OTHER_MARKET_CODE,
      quantity: qty,
    });
  }

  return entries;
}

/** Assigned dispatch BOX quantity (for market report box total). */
export async function fetchDispatchBoxQuantity(
  start: Date,
  end: Date
): Promise<number> {
  const lines = await prisma.inboundLine.findMany({
    where: {
      dispatchStatus: "assigned",
      isBox: true,
      dispatchLines: {
        some: {
          dispatchOrder: {
            date: { gte: start, lte: end },
            status: { notIn: ["draft", "cancelled"] },
          },
        },
      },
    },
    select: { quantity: true },
  });

  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export async function fetchMarketDispatchEntries(
  start: Date,
  end: Date
): Promise<DispatchQuantityEntry[]> {
  const lines = await prisma.inboundLine.findMany({
    where: {
      dispatchStatus: "assigned",
      isBox: false,
      dispatchLines: {
        some: {
          dispatchOrder: {
            date: { gte: start, lte: end },
            status: { notIn: ["draft", "cancelled"] },
          },
        },
      },
    },
    include: {
      stall: { include: { market: true } },
      dispatchLines: {
        include: { dispatchOrder: { select: { date: true } } },
      },
    },
  });

  const entries: DispatchQuantityEntry[] = [];

  for (const line of lines) {
    const dispatchLine = line.dispatchLines[0];
    if (!dispatchLine) continue;

    const marketCode = line.stall.market?.code;
    if (!marketCode) continue;

    const dispatchDate = dispatchLine.dispatchOrder.date;

    entries.push({
      dateKey: toDateInputValue(dispatchDate),
      monthKey: monthKeyFromDate(dispatchDate),
      columnCode: marketCode,
      quantity: line.quantity,
    });
  }

  return entries;
}

export async function fetchCrateDispatchEntries(
  start: Date,
  end: Date,
  mapColumnCode: (tongCode: string) => string
): Promise<DispatchQuantityEntry[]> {
  const lines = await prisma.inboundLine.findMany({
    where: {
      dispatchStatus: "assigned",
      dispatchLines: {
        some: {
          dispatchOrder: {
            date: { gte: start, lte: end },
            status: { notIn: ["draft", "cancelled"] },
          },
        },
      },
    },
    include: {
      tongType: true,
      dispatchLines: {
        include: { dispatchOrder: { select: { date: true } } },
      },
    },
  });

  const entries: DispatchQuantityEntry[] = [];

  for (const line of lines) {
    const dispatchLine = line.dispatchLines[0];
    if (!dispatchLine) continue;

    const dispatchDate = dispatchLine.dispatchOrder.date;

    entries.push({
      dateKey: toDateInputValue(dispatchDate),
      monthKey: monthKeyFromDate(dispatchDate),
      columnCode: mapColumnCode(line.tongType.code),
      quantity: line.quantity,
    });
  }

  return entries;
}
