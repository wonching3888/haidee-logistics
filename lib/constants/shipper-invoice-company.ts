export const SHIPPER_INVOICE_COMPANIES = [
  { value: "haidee", label: "海利 HAIDEE (默认)" },
  { value: "hupdee_bbl", label: "HUP DEE — Bangkok Bank 7044" },
  { value: "hupdee_kbank", label: "HUP DEE — Kasikorn Bank 5020" },
] as const;

export type ShipperInvoiceCompany =
  (typeof SHIPPER_INVOICE_COMPANIES)[number]["value"];

export function isShipperInvoiceCompany(
  value: string | null | undefined
): value is ShipperInvoiceCompany {
  return SHIPPER_INVOICE_COMPANIES.some((item) => item.value === value);
}

export function normalizeShipperInvoiceCompany(
  value: string | null | undefined
): ShipperInvoiceCompany {
  return isShipperInvoiceCompany(value) ? value : "haidee";
}
