import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";

export async function loadExchangeRate(year: number, month: number) {
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
  const row = await prisma.exchangeRate.findUnique({ where: { yearMonth } });
  const rate = decimalToNumber(row?.rate);
  return rate && rate > 0 ? rate : DEFAULT_EXCHANGE_RATE;
}
