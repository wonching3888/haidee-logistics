import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/date-utils";
import type { DispatchQuantityEntry } from "@/lib/reports/fetch-dispatch-quantities";

function monthKeyFromDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export async function fetchCrateReturnMarketEntries(
  start: Date,
  end: Date
): Promise<DispatchQuantityEntry[]> {
  const imports = await prisma.tongImport.findMany({
    where: {
      date: { gte: start, lte: end },
      quantity: { gt: 0 },
    },
    select: {
      date: true,
      quantity: true,
      market: { select: { code: true } },
    },
  });

  const entries: DispatchQuantityEntry[] = [];
  for (const row of imports) {
    const marketCode = row.market?.code;
    if (!marketCode) continue;
    entries.push({
      dateKey: toDateInputValue(row.date),
      monthKey: monthKeyFromDate(row.date),
      columnCode: marketCode,
      quantity: row.quantity,
    });
  }
  return entries;
}

export async function fetchCrateReturnTypeEntries(
  start: Date,
  end: Date,
  mapColumnCode: (tongCode: string) => string
): Promise<DispatchQuantityEntry[]> {
  const imports = await prisma.tongImport.findMany({
    where: {
      date: { gte: start, lte: end },
      quantity: { gt: 0 },
    },
    select: {
      date: true,
      quantity: true,
      tongType: { select: { code: true } },
    },
  });

  const entries: DispatchQuantityEntry[] = [];
  for (const row of imports) {
    entries.push({
      dateKey: toDateInputValue(row.date),
      monthKey: monthKeyFromDate(row.date),
      columnCode: mapColumnCode(row.tongType.code),
      quantity: row.quantity,
    });
  }
  return entries;
}
