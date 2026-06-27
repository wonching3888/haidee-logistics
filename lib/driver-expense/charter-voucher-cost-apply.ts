import type { Prisma } from "@prisma/client";
import { invalidatePnlTripsCache } from "@/lib/pnl-cache-invalidation";

/**
 * Confirm/approve (charter): write voucher actuals to charter cost columns.
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
      chopBorderActual: true,
      upahTurunActual: true,
      upahNaikTongActual: true,
      otherActual: true,
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
      charterBorderPassOverride: voucher.chopBorderActual,
      charterUnloadFeeOverride: voucher.upahTurunActual,
      charterOtherCostOverride: voucher.otherActual,
      charterLoadingLaborMyr: voucher.upahNaikTongActual,
    },
  });

  invalidatePnlTripsCache();

  return tx.driverVoucher.findUniqueOrThrow({ where: { id: voucherId } });
}

/** Rejected: clear charter unload/other overrides applied from voucher actuals. */
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
    data: {
      charterBorderPassOverride: null,
      charterUnloadFeeOverride: null,
      charterOtherCostOverride: null,
      charterLoadingLaborMyr: null,
    },
  });

  invalidatePnlTripsCache();

  return tx.driverVoucher.findUniqueOrThrow({ where: { id: voucherId } });
}
