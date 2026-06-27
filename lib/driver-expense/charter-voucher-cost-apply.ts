import type { Prisma } from "@prisma/client";

/**
 * Confirm/approve (charter): write upahTurunActual → charterUnloadFeeOverride only.
 * Other override columns are handled in later batches.
 */
export async function applyCharterVoucherCostActuals(
  voucherId: string,
  tx: Prisma.TransactionClient
) {
  const voucher = await tx.driverVoucher.findUniqueOrThrow({
    where: { id: voucherId },
    select: {
      id: true,
      tripId: true,
      tripSource: true,
      upahTurunActual: true,
    },
  });

  if (voucher.tripSource !== "charter") {
    throw new Error(
      "applyCharterVoucherCostActuals requires a charter voucher / 仅适用于包车报销单"
    );
  }

  await tx.charterTrip.update({
    where: { id: voucher.tripId },
    data: {
      charterUnloadFeeOverride: voucher.upahTurunActual,
    },
  });

  return tx.driverVoucher.findUniqueOrThrow({ where: { id: voucherId } });
}

/** Rejected: clear charter unload override only (batch 2 scope). */
export async function clearCharterVoucherCostActuals(
  voucherId: string,
  tx: Prisma.TransactionClient
) {
  const voucher = await tx.driverVoucher.findUniqueOrThrow({
    where: { id: voucherId },
    select: { tripId: true, tripSource: true },
  });

  if (voucher.tripSource !== "charter") {
    throw new Error(
      "clearCharterVoucherCostActuals requires a charter voucher / 仅适用于包车报销单"
    );
  }

  await tx.charterTrip.update({
    where: { id: voucher.tripId },
    data: { charterUnloadFeeOverride: null },
  });

  return tx.driverVoucher.findUniqueOrThrow({ where: { id: voucherId } });
}
