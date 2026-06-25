import { prisma } from "@/lib/prisma";

export const MARKET_ACTUAL_FEE_TYPES = ["parking", "kpb", "unload"] as const;

export type MarketActualFeeType = (typeof MARKET_ACTUAL_FEE_TYPES)[number];

export function isMarketActualFeeType(value: string): value is MarketActualFeeType {
  return (MARKET_ACTUAL_FEE_TYPES as readonly string[]).includes(value);
}

export interface MarketActualInput {
  feeType: MarketActualFeeType;
  displayMarket: string;
  amount: number | null;
}

export interface MarketActualRow {
  id: string;
  voucherId: string;
  feeType: MarketActualFeeType;
  displayMarket: string;
  amount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

function normalizeDisplayMarket(displayMarket: string) {
  return displayMarket.trim();
}

function mapRow(row: {
  id: string;
  voucherId: string;
  feeType: string;
  displayMarket: string;
  amount: number | null;
  createdAt: Date;
  updatedAt: Date;
}): MarketActualRow {
  if (!isMarketActualFeeType(row.feeType)) {
    throw new Error(`Invalid market actual fee_type: ${row.feeType}`);
  }
  return {
    id: row.id,
    voucherId: row.voucherId,
    feeType: row.feeType,
    displayMarket: row.displayMarket,
    amount: row.amount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listMarketActualsByVoucherId(
  voucherId: string
): Promise<MarketActualRow[]> {
  const rows = await prisma.driverVoucherMarketActual.findMany({
    where: { voucherId },
    orderBy: [{ feeType: "asc" }, { displayMarket: "asc" }],
  });
  return rows.map(mapRow);
}

export async function upsertMarketActualsForVoucher(
  voucherId: string,
  items: MarketActualInput[]
): Promise<MarketActualRow[]> {
  for (const item of items) {
    if (!isMarketActualFeeType(item.feeType)) {
      throw new Error(`Invalid fee_type: ${item.feeType}`);
    }
  }

  await prisma.$transaction(
    items.map((item) =>
      prisma.driverVoucherMarketActual.upsert({
        where: {
          voucherId_feeType_displayMarket: {
            voucherId,
            feeType: item.feeType,
            displayMarket: normalizeDisplayMarket(item.displayMarket),
          },
        },
        create: {
          voucherId,
          feeType: item.feeType,
          displayMarket: normalizeDisplayMarket(item.displayMarket),
          amount: item.amount,
        },
        update: {
          amount: item.amount,
        },
      })
    )
  );

  return listMarketActualsByVoucherId(voucherId);
}

export async function deleteMarketActualsForVoucher(voucherId: string) {
  return prisma.driverVoucherMarketActual.deleteMany({
    where: { voucherId },
  });
}

export function sumMarketActualAmounts(
  rows: Pick<MarketActualRow, "feeType" | "amount">[],
  feeType: MarketActualFeeType
) {
  let total = 0;
  for (const row of rows) {
    if (row.feeType !== feeType || row.amount == null) continue;
    total += row.amount;
  }
  return Math.round(total * 100) / 100;
}

export function hasMarketActualAmounts(
  rows: Pick<MarketActualRow, "feeType" | "amount">[],
  feeType: MarketActualFeeType
) {
  return rows.some((row) => row.feeType === feeType && row.amount != null);
}

/** Mirror per-market rows onto voucher scalar fields (parking/kpb/upahTurun). */
export function marketActualRowsToScalarPatch(
  rows: Pick<MarketActualRow, "feeType" | "amount">[]
): Partial<{
  parkingActual: number;
  kpbActual: number;
  upahTurunActual: number;
}> {
  const patch: Partial<{
    parkingActual: number;
    kpbActual: number;
    upahTurunActual: number;
  }> = {};
  if (hasMarketActualAmounts(rows, "parking")) {
    patch.parkingActual = sumMarketActualAmounts(rows, "parking");
  }
  if (hasMarketActualAmounts(rows, "kpb")) {
    patch.kpbActual = sumMarketActualAmounts(rows, "kpb");
  }
  if (hasMarketActualAmounts(rows, "unload")) {
    patch.upahTurunActual = sumMarketActualAmounts(rows, "unload");
  }
  return patch;
}
