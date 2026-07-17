import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/date-utils";
import { loadActiveCrateReturnFreightRates } from "@/lib/crate-return-billing";
import type { DispatchQuantityEntry } from "@/lib/reports/fetch-dispatch-quantities";

function monthKeyFromDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** 回收桶(顾客自有桶) TongImport 记录，按市场分组。范围跟 aggregateCrateReturnIncomeMyr 一致：
    只算已配置回收桶运费/收桶费的那些桶型。 */
export async function fetchCrateReturnMarketEntries(
  start: Date,
  end: Date
): Promise<DispatchQuantityEntry[]> {
  const rates = await loadActiveCrateReturnFreightRates();
  if (rates.length === 0) return [];
  const eligibleCrateTypes = rates.map((rate) => rate.crateType);

  const imports = await prisma.tongImport.findMany({
    where: {
      date: { gte: start, lte: end },
      quantity: { gt: 0 },
      tongType: { code: { in: eligibleCrateTypes } },
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

/** 同样的回收桶范围，改成按桶型分组。 */
export async function fetchCrateReturnTypeEntries(
  start: Date,
  end: Date,
  mapColumnCode: (tongCode: string) => string
): Promise<DispatchQuantityEntry[]> {
  const rates = await loadActiveCrateReturnFreightRates();
  if (rates.length === 0) return [];
  const eligibleCrateTypes = rates.map((rate) => rate.crateType);

  const imports = await prisma.tongImport.findMany({
    where: {
      date: { gte: start, lte: end },
      quantity: { gt: 0 },
      tongType: { code: { in: eligibleCrateTypes } },
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
