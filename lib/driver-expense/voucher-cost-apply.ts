import type { Prisma } from "@prisma/client";
import {
  feeMarketsForDisplayMarket,
  primaryFeeMarketForDisplay,
} from "@/lib/driver-expense/market-display-map";
import {
  isMarketActualFeeType,
  sumMarketActualAmounts,
  type MarketActualFeeType,
} from "@/lib/driver-expense/market-actuals-service";
import { roundMoney, sumActualBelanja } from "@/lib/driver-expense/voucher-utils";

type UnloadingFeeRow = {
  id: string;
  market: string;
};

async function applyDisplayMarketUnloadingOverride(
  tx: Prisma.TransactionClient,
  displayMarket: string,
  feeType: "kpb" | "unload",
  amount: number,
  unloadingRows: UnloadingFeeRow[]
) {
  const groupMarkets = feeMarketsForDisplayMarket(displayMarket);
  const presentInGroup = unloadingRows.filter((row) =>
    groupMarkets.includes(row.market)
  );
  if (presentInGroup.length === 0) return;

  const primary = primaryFeeMarketForDisplay(
    displayMarket,
    presentInGroup.map((row) => row.market)
  );
  if (!primary) return;

  const overrideField =
    feeType === "kpb" ? "kpbFeeOverride" : "unloadFeeOverride";

  await Promise.all(
    presentInGroup.map((row) =>
      tx.unloadingFee.update({
        where: { id: row.id },
        data: {
          [overrideField]: row.market === primary ? amount : 0,
        },
      })
    )
  );
}

function hasMarketActualAmounts(
  rows: { feeType: string; amount: number | null }[],
  feeType: MarketActualFeeType
) {
  return rows.some((row) => row.feeType === feeType && row.amount != null);
}

function buildScalarPatchFromMarketActuals(
  rows: { feeType: MarketActualFeeType; amount: number | null }[]
) {
  const patch: {
    parkingActual?: number | null;
    kpbActual?: number | null;
    upahTurunActual?: number | null;
  } = {};

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

/**
 * Confirm/approve: write market_actuals 1:1 to unloading fee overrides (no proportional split),
 * mirror parking/kpb/unload scalars on voucher, set cost_applied_at.
 * Parking has no unloading_fees column — stored on voucher.parking_actual only.
 */
export async function applyVoucherCostActuals(
  voucherId: string,
  tx: Prisma.TransactionClient,
  now: Date = new Date()
) {
  const voucher = await tx.driverVoucher.findUniqueOrThrow({
    where: { id: voucherId },
  });

  const marketActuals = await tx.driverVoucherMarketActual.findMany({
    where: { voucherId },
    orderBy: [{ feeType: "asc" }, { displayMarket: "asc" }],
  });

  const unloadingRows = await tx.unloadingFee.findMany({
    where: { tripId: voucher.tripId },
    orderBy: { createdAt: "asc" },
  });

  for (const actual of marketActuals) {
    if (!isMarketActualFeeType(actual.feeType)) continue;
    if (actual.feeType === "parking") continue;
    if (actual.amount == null) continue;
    await applyDisplayMarketUnloadingOverride(
      tx,
      actual.displayMarket,
      actual.feeType,
      actual.amount,
      unloadingRows
    );
  }

  const scalarRows = marketActuals.flatMap((row) => {
    if (!isMarketActualFeeType(row.feeType)) return [];
    return [{ feeType: row.feeType, amount: row.amount }];
  });
  const scalarPatch = buildScalarPatchFromMarketActuals(scalarRows);
  const merged = { ...voucher, ...scalarPatch };
  const belanja = sumActualBelanja(merged);
  const baki =
    merged.duitJalan != null ? roundMoney(merged.duitJalan - belanja) : null;

  return tx.driverVoucher.update({
    where: { id: voucherId },
    data: {
      ...scalarPatch,
      belanja,
      baki,
      costAppliedAt: now,
    },
  });
}

/** Rejected: clear trip overrides; keep market_actuals draft; clear cost_applied_at. */
export async function clearVoucherCostActuals(
  voucherId: string,
  tx: Prisma.TransactionClient
) {
  const voucher = await tx.driverVoucher.findUniqueOrThrow({
    where: { id: voucherId },
    select: { tripId: true },
  });

  await tx.unloadingFee.updateMany({
    where: { tripId: voucher.tripId },
    data: {
      unloadFeeOverride: null,
      kpbFeeOverride: null,
    },
  });

  await tx.crateLoadingFee.updateMany({
    where: { tripId: voucher.tripId },
    data: { loadingFeeOverride: null },
  });

  return tx.driverVoucher.update({
    where: { id: voucherId },
    data: { costAppliedAt: null },
  });
}
