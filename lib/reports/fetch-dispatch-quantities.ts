import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/date-utils";

export interface DispatchQuantityEntry {
  dateKey: string;
  monthKey: string;
  columnCode: string;
  quantity: number;
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
    const y = dispatchDate.getUTCFullYear();
    const m = dispatchDate.getUTCMonth() + 1;

    entries.push({
      dateKey: toDateInputValue(dispatchDate),
      monthKey: `${y}-${String(m).padStart(2, "0")}`,
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
    const y = dispatchDate.getUTCFullYear();
    const m = dispatchDate.getUTCMonth() + 1;

    entries.push({
      dateKey: toDateInputValue(dispatchDate),
      monthKey: `${y}-${String(m).padStart(2, "0")}`,
      columnCode: mapColumnCode(line.tongType.code),
      quantity: line.quantity,
    });
  }

  return entries;
}
