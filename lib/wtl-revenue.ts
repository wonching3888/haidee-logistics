import { convertThbToMyr } from "@/lib/freight-rates";
import {
  freightAmountMyrEquivalent,
  type InboundLineFreightSnapshot,
} from "@/lib/inbound-freight";
import { splitWtlSst } from "@/lib/wtl-sst";

/** WTL SST is excluded from company revenue on/after this dispatch date. */
export const WTL_SST_EXCLUDE_FROM = new Date("2026-06-01T00:00:00.000Z");

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function shouldExcludeWtlSstFromRevenue(tripDate: Date): boolean {
  return tripDate >= WTL_SST_EXCLUDE_FROM;
}

function hasWtlFreightSegment(snapshot: InboundLineFreightSnapshot): boolean {
  return (
    (snapshot.thFreightAmount ?? 0) > 0 ||
    (snapshot.mySegmentFreightAmount ?? 0) > 0
  );
}

/**
 * MYR freight revenue for WTL-billed lines (invoice modes 3/4).
 * When excludeSst is true, SST is stripped per segment rules (never double-split).
 */
export function wtlBillingFreightRevenueMyr(
  snapshot: InboundLineFreightSnapshot,
  excludeSst: boolean
): number {
  if (!excludeSst || snapshot.billingCompany !== "wtl") {
    if (snapshot.currency === "MYR" && snapshot.freightAmount != null) {
      return snapshot.freightAmount;
    }
    return 0;
  }

  if (hasWtlFreightSegment(snapshot)) {
    return roundMoney(
      (snapshot.thFreightAmount ?? 0) +
        splitWtlSst(snapshot.mySegmentFreightAmount ?? 0).exTax
    );
  }

  if (snapshot.currency === "MYR" && snapshot.freightAmount != null) {
    return splitWtlSst(snapshot.freightAmount).exTax;
  }

  return snapshot.freightAmount ?? 0;
}

/** Dual-payment WTL MYR portion (Mode 3 secondary income). */
export function dualPaymentWtlRevenueMyr(
  snapshot: InboundLineFreightSnapshot,
  excludeSst: boolean
): number {
  const amount = snapshot.dualPaymentWtlAmount ?? 0;
  if (amount <= 0) return 0;
  return excludeSst ? splitWtlSst(amount).exTax : amount;
}

/**
 * P&L / revenue line income in MYR.
 * Pass dispatch.date as tripDate for SST effective-date gating.
 */
export function lineRevenueMyr(
  snapshot: InboundLineFreightSnapshot,
  exchangeRate: number,
  tripDate: Date
): number {
  if (snapshot.freightAmount == null || snapshot.freightAmount <= 0) {
    return 0;
  }

  const excludeSst = shouldExcludeWtlSstFromRevenue(tripDate);
  let total = 0;

  if (snapshot.paymentMode === "1a" && snapshot.currency === "THB") {
    total += roundMoney(convertThbToMyr(snapshot.freightAmount, exchangeRate));
  } else if (snapshot.billingCompany === "wtl" && excludeSst) {
    total += wtlBillingFreightRevenueMyr(snapshot, true);
  } else if (snapshot.currency === "MYR") {
    total += snapshot.freightAmount;
  } else {
    const eq = freightAmountMyrEquivalent(snapshot);
    if (eq != null) total += eq;
  }

  total += dualPaymentWtlRevenueMyr(snapshot, excludeSst);
  return roundMoney(total);
}

/** Operations income: MYR amount to bucket for main freight line. */
export function operationsFreightIncomeMyr(
  snapshot: InboundLineFreightSnapshot,
  tripDate: Date
): number {
  const excludeSst = shouldExcludeWtlSstFromRevenue(tripDate);
  if (snapshot.billingCompany === "wtl" && excludeSst) {
    return wtlBillingFreightRevenueMyr(snapshot, true);
  }
  return snapshot.freightAmount ?? 0;
}

/** NKL permit per trip — ex-SST when revenue exclusion applies. */
export function nklPermitRevenueMyr(
  permitPerTripInclusive: number,
  tripDate: Date
): number {
  if (permitPerTripInclusive <= 0) return 0;
  return shouldExcludeWtlSstFromRevenue(tripDate)
    ? splitWtlSst(permitPerTripInclusive).exTax
    : permitPerTripInclusive;
}
