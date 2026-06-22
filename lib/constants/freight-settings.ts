import type { MessageKey } from "@/lib/i18n/messages";
import { t, tLocal } from "@/lib/i18n/translate";
import type { UserLanguage } from "@/types";

export const DEFAULT_EXCHANGE_RATE = 8.2;

/** Malaysia SST rate applied to WTL MY-segment freight when sst_applicable. */
export const WTL_SST_MULTIPLIER = 1.06;

export const PAYMENT_MODES = [
  { value: "1a" },
  { value: "1b" },
  { value: "2" },
  { value: "3" },
] as const;

export type PaymentMode = (typeof PAYMENT_MODES)[number]["value"];

const PAYMENT_MODE_KEYS: Record<PaymentMode, MessageKey> = {
  "1a": "mode.1a",
  "1b": "mode.1b",
  "2": "mode.2",
  "3": "mode.3",
};

export const BILLING_COMPANIES = [
  { value: "haidee", label: "HAIDEE" },
  { value: "wtl", label: "WTL" },
] as const;

export type BillingCompany = (typeof BILLING_COMPANIES)[number]["value"];

export function getPaymentModeLabel(
  mode: string,
  locale: UserLanguage = "zh"
): string {
  if (!isPaymentMode(mode)) return mode;
  const key = PAYMENT_MODE_KEYS[mode];
  if (mode === "1a" || mode === "1b") {
    return tLocal(key, locale);
  }
  return t(key, locale);
}

export function getBillingCompanyLabel(company: string) {
  return (
    BILLING_COMPANIES.find((item) => item.value === company)?.label ?? company
  );
}

export function isPaymentMode(value: string): value is PaymentMode {
  return PAYMENT_MODES.some((item) => item.value === value);
}

export function isBillingCompany(value: string): value is BillingCompany {
  return BILLING_COMPANIES.some((item) => item.value === value);
}
