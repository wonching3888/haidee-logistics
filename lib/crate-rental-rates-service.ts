import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import {
  DEFAULT_CRATE_RENTAL_RATES,
  sortCrateRentalRates,
} from "@/lib/constants/crate-rental-rates";

export interface CrateRentalRateRow {
  id: string;
  crateType: string;
  isRental: boolean;
  rateMyr: number;
  notes: string | null;
}

function serializeCrateRentalRate(row: {
  id: string;
  crateType: string;
  isRental: boolean;
  rateMyr: unknown;
  notes: string | null;
}): CrateRentalRateRow {
  return {
    id: row.id,
    crateType: row.crateType,
    isRental: row.isRental,
    rateMyr: decimalToNumber(row.rateMyr) ?? 0,
    notes: row.notes,
  };
}

export async function ensureCrateRentalRatesSeeded() {
  await Promise.all(
    DEFAULT_CRATE_RENTAL_RATES.map((item) =>
      prisma.crateRentalRate.upsert({
        where: { crateType: item.crateType },
        create: {
          crateType: item.crateType,
          isRental: item.isRental,
          rateMyr: item.rateMyr,
          notes: item.notes,
        },
        update: {},
      })
    )
  );
}

export async function listCrateRentalRates(): Promise<CrateRentalRateRow[]> {
  await ensureCrateRentalRatesSeeded();
  const rows = await prisma.crateRentalRate.findMany();
  return sortCrateRentalRates(rows.map(serializeCrateRentalRate));
}

function parseRateMyr(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} 不能为负数`);
  }
  return value;
}

export async function saveCrateRentalRatesBatch(
  input: {
    crateType: string;
    rateMyr: number;
    notes?: string | null;
  }[]
) {
  const existing = await listCrateRentalRates();
  const existingByType = new Map(existing.map((row) => [row.crateType, row]));

  await prisma.$transaction(
    input.map((item) => {
      const current = existingByType.get(item.crateType);
      if (!current) {
        throw new Error(`未知桶型 Unknown crate type: ${item.crateType}`);
      }

      return prisma.crateRentalRate.update({
        where: { crateType: item.crateType },
        data: {
          rateMyr: current.isRental
            ? parseRateMyr(item.rateMyr, item.crateType)
            : 0,
          notes: item.notes?.trim() || null,
        },
      });
    })
  );

  return listCrateRentalRates();
}
