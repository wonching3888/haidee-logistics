import type { PaymentMode } from "@/lib/constants/freight-settings";

export type MonthlyInvoiceMode = "1a" | "1b" | "2" | "3" | "4";

export type MonthlyInvoiceBillTo = "shipper" | "consignee";

export interface MonthlyInvoiceModeConfig {
  value: MonthlyInvoiceMode;
  /** Omitted for mode 4 (WTL shipper filter uses billing + currency). */
  paymentMode?: PaymentMode;
  billingCompany: "haidee" | "wtl";
  currency: "THB" | "MYR";
  billTo: MonthlyInvoiceBillTo;
  issuerKey: "haidee" | "wtl";
  label: string;
  labelEn: string;
  sstNote?: boolean;
  /** TH/MY dual-segment line layout (mode 4). */
  dualSegmentDisplay?: boolean;
  /** Footnote for MY segment SST on dual-segment invoices. */
  mySegmentSstNote?: boolean;
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
  {
    value: "4",
    billingCompany: "wtl",
    currency: "MYR",
    billTo: "shipper",
    issuerKey: "wtl",
    label: "模式4 — WTL EXPRESS → 泰国寄货人 (MYR)",
    labelEn: "Mode 4 — WTL EXPRESS → TH Shipper (MYR)",
    dualSegmentDisplay: true,
    mySegmentSstNote: true,
  },
];

export const INVOICE_COMPANY_HEADERS = {
  haidee: {
    nameZh: "海利物流有限公司",
    nameEn: "HAI DEE LOGISTICS CO., LTD",
  },
  wtl: {
    nameZh: "WTL EXPRESS SDN BHD (202201017123(1462820-W))",
    nameEn: "WTL EXPRESS SDN BHD",
    addressLine1: "LOT 1918, KAMPUNG BARU, PEKAN BARU,",
    addressLine2: "06010 CHANGLOON, KEDAH, MALAYSIA.",
    phone: "Tel: 011-11503888 & 011-60603888",
    sstRegistrationNo: "SST No.: K10-2403-32000055",
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
