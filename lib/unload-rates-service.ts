import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import {
  sortUnloadRates,
  UNLOAD_CRATE_TYPES,
  UNLOAD_MARKET_CODES,
  unloadRateKey,
} from "@/lib/constants/unload-rates";
import { isMissingUnloadRatesTableError } from "@/lib/create-unload-rates-table";

export interface UnloadRateRow {
  id: string;
  marketCode: string;
  crateType: string;
  rateMyr: number;
  notes: string | null;
}

function serializeRow(row: {
  id: string;
  marketCode: string;
  crateType: string;
  rateMyr: unknown;
  notes: string | null;
}): UnloadRateRow {
  return {
    id: row.id,
    marketCode: row.marketCode,
    crateType: row.crateType,
    rateMyr: decimalToNumber(row.rateMyr) ?? 0,
    notes: row.notes,
  };
}

export async function ensureUnloadRatesSeeded() {
  try {
    const existingCount = await prisma.unloadRate.count();
    if (existingCount > 0) return;

    const markets = await prisma.market.findMany({
      where: { active: true, code: { not: "OTHER" } },
      select: { code: true, loadUnloadPerCrate: true },
    });

    await prisma.unloadRate.createMany({
      data: markets.flatMap((market) =>
        UNLOAD_CRATE_TYPES.map((crateType) => ({
          marketCode: market.code,
          crateType,
          rateMyr: decimalToNumber(market.loadUnloadPerCrate) ?? 0,
        }))
      ),
      skipDuplicates: true,
    });
  } catch (error) {
    if (isMissingUnloadRatesTableError(error)) return;
    throw error;
  }
}

export async function listUnloadRates(): Promise<UnloadRateRow[]> {
  try {
    await ensureUnloadRatesSeeded();
    const rows = await prisma.unloadRate.findMany();
    return sortUnloadRates(rows.map(serializeRow));
  } catch (error) {
    if (isMissingUnloadRatesTableError(error)) {
      return [];
    }
    throw error;
  }
}

export async function listUnloadRatesMatrix() {
  const rows = await listUnloadRates();
  const byKey = new Map(
    rows.map((row) => [unloadRateKey(row.marketCode, row.crateType), row])
  );

  return UNLOAD_MARKET_CODES.map((marketCode) => ({
    marketCode,
    rates: UNLOAD_CRATE_TYPES.map((crateType) => {
      const row = byKey.get(unloadRateKey(marketCode, crateType));
      return {
        id: row?.id ?? `${marketCode}:${crateType}`,
        marketCode,
        crateType,
        rateMyr: row?.rateMyr ?? 0,
        notes: row?.notes ?? null,
      };
    }),
  }));
}

function parseRateMyr(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} 不能为负数`);
  }
  return value;
}

export async function saveUnloadRatesBatch(
  input: {
    marketCode: string;
    crateType: string;
    rateMyr: number;
    notes?: string | null;
  }[]
) {
  await prisma.$transaction(
    input.map((item) =>
      prisma.unloadRate.update({
        where: {
          marketCode_crateType: {
            marketCode: item.marketCode,
            crateType: item.crateType,
          },
        },
        data: {
          rateMyr: parseRateMyr(
            item.rateMyr,
            `${item.marketCode} ${item.crateType}`
          ),
          notes: item.notes?.trim() || null,
        },
      })
    )
  );

  return listUnloadRates();
}

export async function lookupUnloadRateMap() {
  const rows = await listUnloadRates();
  return new Map(
    rows.map((row) => [unloadRateKey(row.marketCode, row.crateType), row.rateMyr])
  );
}
