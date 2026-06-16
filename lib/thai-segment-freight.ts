import type { PickupLocation } from "@/lib/constants/pickup-locations";
import type { ThaiSegmentRates } from "@/lib/constants/thai-segment-rates";
import { MC_MARKET_CODE } from "@/lib/inbound-freight";
import {
  convertMyrToThb,
  convertThbToMyr,
  decimalToNumber,
} from "@/lib/freight-rates";

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Step 1: convert line freight total to THB for internal split. */
export function freightTotalThb(input: {
  freightAmount: number | null | undefined;
  currency: string | null | undefined;
  paymentMode: string | null | undefined;
  exchangeRate: number;
}): number {
  const amount = input.freightAmount ?? 0;
  if (amount <= 0) return 0;

  const mode = input.paymentMode;
  const currency = (input.currency ?? "THB").toUpperCase();

  if (mode === "1a" || currency === "THB") {
    return roundMoney(amount);
  }

  return roundMoney(convertMyrToThb(amount, input.exchangeRate));
}

/** Step 2: Thai-segment freight in THB from pickup location rates. */
export function computeThaiSegmentThb(
  pickupLocation: PickupLocation,
  quantity: number,
  isBox: boolean,
  rates: ThaiSegmentRates
): number {
  if (quantity <= 0 || pickupLocation === "SADAO") return 0;

  let unitRate = 0;
  if (pickupLocation === "SONGKHLA") {
    unitRate = isBox ? rates.songkhlaRateBox : rates.songkhlaRateTong;
  } else if (pickupLocation === "PATTANI") {
    unitRate = isBox ? rates.pattaniRateBox : rates.pattaniRateTong;
  }

  if (unitRate <= 0) return 0;
  return roundMoney(quantity * unitRate);
}

export function computeMySegmentThb(totalFreightThb: number, thaiSegmentThb: number) {
  return roundMoney(Math.max(0, totalFreightThb - thaiSegmentThb));
}

/** Step 3 & 4: derive MY/TH segments; return Thai-segment cost in MYR. */
export function computeLineThaiSegmentCostMyr(input: {
  pickupLocation: PickupLocation;
  quantity: number;
  isBox: boolean;
  freightAmount: unknown;
  currency: string | null | undefined;
  paymentMode: string | null | undefined;
  exchangeRate: number;
  rates: ThaiSegmentRates;
  marketCode?: string | null;
}): number {
  if (input.marketCode === MC_MARKET_CODE) return 0;

  const freightAmount = decimalToNumber(input.freightAmount);
  const totalFreightThb = freightTotalThb({
    freightAmount,
    currency: input.currency,
    paymentMode: input.paymentMode,
    exchangeRate: input.exchangeRate,
  });
  if (totalFreightThb <= 0) return 0;

  const thaiSegmentThb = computeThaiSegmentThb(
    input.pickupLocation,
    input.quantity,
    input.isBox,
    input.rates
  );
  if (thaiSegmentThb <= 0) return 0;

  return roundMoney(convertThbToMyr(thaiSegmentThb, input.exchangeRate));
}

export function computeLineThaiSegmentSplit(input: {
  pickupLocation: PickupLocation;
  quantity: number;
  isBox: boolean;
  freightAmount: unknown;
  currency: string | null | undefined;
  paymentMode: string | null | undefined;
  exchangeRate: number;
  rates: ThaiSegmentRates;
  marketCode?: string | null;
}) {
  const freightAmount = decimalToNumber(input.freightAmount);
  const totalFreightThb = freightTotalThb({
    freightAmount,
    currency: input.currency,
    paymentMode: input.paymentMode,
    exchangeRate: input.exchangeRate,
  });
  const thaiSegmentThb = computeThaiSegmentThb(
    input.pickupLocation,
    input.quantity,
    input.isBox,
    input.rates
  );
  const mySegmentThb = computeMySegmentThb(totalFreightThb, thaiSegmentThb);
  const thaiSegmentMyr = roundMoney(
    convertThbToMyr(thaiSegmentThb, input.exchangeRate)
  );
  const mySegmentMyr = roundMoney(
    convertThbToMyr(mySegmentThb, input.exchangeRate)
  );

  return {
    totalFreightThb,
    thaiSegmentThb,
    mySegmentThb,
    thaiSegmentMyr,
    mySegmentMyr,
  };
}
