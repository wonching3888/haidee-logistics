import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export interface CharterVoucherCostContext {
  tripId: string;
  tripSource: string;
  status: string;
  costAppliedAt: Date | null;
}

/** Cost reads override only when charter voucher is confirmed/approved and applied. */
export function isCharterCostEligible(
  voucher: Pick<
    CharterVoucherCostContext,
    "tripSource" | "status" | "costAppliedAt"
  > | null | undefined
): boolean {
  if (!voucher || voucher.tripSource !== "charter") return false;
  if (voucher.costAppliedAt == null) return false;
  return voucher.status === "confirmed" || voucher.status === "approved";
}

export function resolveCharterScalarCost(
  override: number | null | undefined,
  estimate: number,
  eligible: boolean
): number {
  if (eligible && override != null) {
    return roundMoney(override);
  }
  return roundMoney(estimate);
}

export function resolveCharterEffectiveUnload(input: {
  charterUnloadFeeMyr: unknown;
  charterUnloadFeeOverride: unknown;
  voucher?: CharterVoucherCostContext | null;
}): number {
  const estimate = decimalToNumber(input.charterUnloadFeeMyr) ?? 0;
  const override = decimalToNumber(input.charterUnloadFeeOverride);
  const eligible = isCharterCostEligible(input.voucher);
  return resolveCharterScalarCost(override, estimate, eligible);
}

/** Assert unload is chosen from one source only (never estimate + actual). */
export function assertCharterUnloadNotDoubleCounted(input: {
  effectiveUnload: number;
  estimate: number;
  override: number | null;
  actual: number | null;
  eligible: boolean;
}): void {
  const expected = resolveCharterScalarCost(
    input.override,
    input.estimate,
    input.eligible
  );
  if (input.effectiveUnload !== expected) {
    throw new Error(
      `effectiveUnload ${input.effectiveUnload} !== expected ${expected}`
    );
  }
  if (
    input.eligible &&
    input.override != null &&
    input.effectiveUnload === roundMoney(input.estimate + input.override)
  ) {
    throw new Error("double count: estimate + override");
  }
  if (
    input.eligible &&
    input.actual != null &&
    input.effectiveUnload === roundMoney(input.estimate + input.actual)
  ) {
    throw new Error("double count: estimate + actual");
  }
}

export async function loadCharterVoucherContextByTripId(
  tripIds: string[]
): Promise<Map<string, CharterVoucherCostContext>> {
  if (tripIds.length === 0) return new Map();

  const vouchers = await prisma.driverVoucher.findMany({
    where: { tripId: { in: tripIds }, tripSource: "charter" },
    select: {
      tripId: true,
      tripSource: true,
      status: true,
      costAppliedAt: true,
    },
  });

  return new Map(vouchers.map((row) => [row.tripId, row]));
}
