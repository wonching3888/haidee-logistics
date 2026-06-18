import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import {
  DEFAULT_CRATE_RENTAL_RATES,
  sortCrateRentalRates,
} from "@/lib/constants/crate-rental-rates";
import {
  normalizeCrateRentalCurrency,
  type CrateRentalCurrency,
} from "@/lib/crate-rental-cost";
import { isMissingCrateRentalRatesTableError } from "@/lib/create-crate-rental-rates-table";

export interface CrateRentalRateRow {
  id: string;
  crateType: string;
  isRental: boolean;
  rate: number;
  currency: CrateRentalCurrency;
  notes: string | null;
}

const MAX_CRATE_TYPE_LENGTH = 10;

function serializeCrateRentalRate(row: {
  id: string;
  crateType: string;
  isRental: boolean;
  rate: unknown;
  currency: string;
  notes: string | null;
}): CrateRentalRateRow {
  return {
    id: row.id,
    crateType: row.crateType,
    isRental: row.isRental,
    rate: decimalToNumber(row.rate) ?? 0,
    currency: normalizeCrateRentalCurrency(row.currency),
    notes: row.notes,
  };
}

export async function ensureCrateRentalRatesSeeded() {
  try {
    await Promise.all(
      DEFAULT_CRATE_RENTAL_RATES.map((item) =>
        prisma.crateRentalRate.upsert({
          where: { crateType: item.crateType },
          create: {
            crateType: item.crateType,
            isRental: item.isRental,
            rate: item.rate,
            currency: item.currency,
            notes: item.notes,
          },
          update: {},
        })
      )
    );
  } catch (error) {
    if (isMissingCrateRentalRatesTableError(error)) {
      return;
    }
    throw error;
  }
}

/** Ensure every active tong type has a crate_rental_rates row (after桶型新增/重命名). */
export async function ensureCrateRentalRatesForActiveTongTypes() {
  try {
    const [tongTypes, existing] = await Promise.all([
      prisma.tongType.findMany({
        where: { active: true },
        select: { code: true, trackInventory: true },
      }),
      prisma.crateRentalRate.findMany({ select: { crateType: true } }),
    ]);

    const existingCodes = new Set(existing.map((row) => row.crateType));
    const missing = tongTypes.filter(
      (tongType) =>
        tongType.code.length <= MAX_CRATE_TYPE_LENGTH &&
        !existingCodes.has(tongType.code)
    );

    if (missing.length === 0) return;

    await prisma.crateRentalRate.createMany({
      data: missing.map((tongType) => ({
        crateType: tongType.code,
        isRental: tongType.trackInventory,
        rate: 0,
        currency: "MYR",
      })),
      skipDuplicates: true,
    });
  } catch (error) {
    if (isMissingCrateRentalRatesTableError(error)) {
      return;
    }
    throw error;
  }
}

export async function listCrateRentalRates(): Promise<CrateRentalRateRow[]> {
  try {
    await ensureCrateRentalRatesSeeded();
    await ensureCrateRentalRatesForActiveTongTypes();
    const rows = await prisma.crateRentalRate.findMany();
    return sortCrateRentalRates(rows.map(serializeCrateRentalRate));
  } catch (error) {
    if (isMissingCrateRentalRatesTableError(error)) {
      return [];
    }
    throw error;
  }
}

function parseRate(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} 不能为负数`);
  }
  return value;
}

export async function saveCrateRentalRatesBatch(
  input: {
    crateType: string;
    isRental: boolean;
    rate: number;
    currency: CrateRentalCurrency;
    notes?: string | null;
  }[]
) {
  await ensureCrateRentalRatesForActiveTongTypes();
  const existing = await listCrateRentalRates();
  const existingByType = new Map(existing.map((row) => [row.crateType, row]));

  await prisma.$transaction(
    input.map((item) => {
      const current = existingByType.get(item.crateType);
      const currency = normalizeCrateRentalCurrency(item.currency);
      if (!current) {
        return prisma.crateRentalRate.create({
          data: {
            crateType: item.crateType,
            isRental: item.isRental,
            rate: parseRate(item.rate, item.crateType),
            currency,
            notes: item.notes?.trim() || null,
          },
        });
      }

      return prisma.crateRentalRate.update({
        where: { crateType: item.crateType },
        data: {
          isRental: item.isRental,
          rate: item.isRental ? parseRate(item.rate, item.crateType) : 0,
          currency: item.isRental ? currency : "MYR",
          notes: item.notes?.trim() || null,
        },
      });
    })
  );

  return listCrateRentalRates();
}
