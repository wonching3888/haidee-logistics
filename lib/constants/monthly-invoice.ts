import type { PaymentMode } from "@/lib/constants/freight-settings";

export type MonthlyInvoiceMode = "1a" | "1b" | "2" | "3";

export type MonthlyInvoiceBillTo = "shipper" | "consignee";

export interface MonthlyInvoiceModeConfig {
  value: MonthlyInvoiceMode;
  paymentMode: PaymentMode;
  billingCompany: "haidee" | "wtl";
  currency: "THB" | "MYR";
  billTo: MonthlyInvoiceBillTo;
  issuerKey: "haidee" | "wtl";
  label: string;
  labelEn: string;
  sstNote?: boolean;
}

export const MONTHLY_INVOICE_MODES: MonthlyInvoiceModeConfig[] = [
  {
    value: "1a",
    paymentMode: "1a",
    billingCompany: "haidee",
    currency: "THB",
    billTo: "shipper",
    issuerKey: "haidee",
    label: "模式1a — HAIDEE → 泰国寄货人 (THB)",
    labelEn: "Mode 1a — HAIDEE → TH Shipper (THB)",
  },
  {
    value: "1b",
    paymentMode: "1b",
    billingCompany: "haidee",
    currency: "MYR",
    billTo: "shipper",
    issuerKey: "haidee",
    label: "模式1b — HAIDEE → 泰国寄货人 (MYR)",
    labelEn: "Mode 1b — HAIDEE → TH Shipper (MYR)",
  },
  {
    value: "2",
    paymentMode: "2",
    billingCompany: "haidee",
    currency: "MYR",
    billTo: "consignee",
    issuerKey: "haidee",
    label: "模式2 — HAIDEE → 马来西亚收货人 (MYR)",
    labelEn: "Mode 2 — HAIDEE → MY Consignee (MYR)",
  },
  {
    value: "3",
    paymentMode: "3",
    billingCompany: "wtl",
    currency: "MYR",
    billTo: "consignee",
    issuerKey: "wtl",
    label: "模式3 — WTL EXPRESS → 马来西亚收货人 (MYR)",
    labelEn: "Mode 3 — WTL EXPRESS → MY Consignee (MYR)",
    sstNote: true,
  },
];

export const INVOICE_COMPANY_HEADERS = {
  haidee: {
    nameZh: "海利物流有限公司",
    nameEn: "HAI DEE LOGISTICS CO., LTD",
  },
  wtl: {
    nameZh: "WTL EXPRESS SDN BHD",
    nameEn: "WTL EXPRESS SDN BHD",
  },
} as const;

export function getMonthlyInvoiceModeConfig(
  mode: string
): MonthlyInvoiceModeConfig | undefined {
  return MONTHLY_INVOICE_MODES.find((item) => item.value === mode);
}

export function isMonthlyInvoiceMode(value: string): value is MonthlyInvoiceMode {
  return MONTHLY_INVOICE_MODES.some((item) => item.value === value);
}

export function formatInvoicePeriodLabel(year: number, month: number) {
  return `${year}年${month}月 / ${String(month).padStart(2, "0")}-${year}`;
}
