export const DEFAULT_EXCHANGE_RATE = 8.2;

/** Malaysia SST rate applied to WTL MY-segment freight when sst_applicable. */
export const WTL_SST_MULTIPLIER = 1.06;

export const PAYMENT_MODES = [
  { value: "1a", label: "1a 寄货人付 THB" },
  { value: "1b", label: "1b 寄货人付 MYR" },
  { value: "2", label: "2 收货人付 Consignee pays" },
  { value: "3", label: "3 其他 Other" },
] as const;

export type PaymentMode = (typeof PAYMENT_MODES)[number]["value"];

export const BILLING_COMPANIES = [
  { value: "haidee", label: "HAIDEE" },
  { value: "wtl", label: "WTL" },
] as const;

export type BillingCompany = (typeof BILLING_COMPANIES)[number]["value"];

export function getPaymentModeLabel(mode: string) {
  return PAYMENT_MODES.find((item) => item.value === mode)?.label ?? mode;
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
