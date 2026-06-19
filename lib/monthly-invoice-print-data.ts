import type { MonthlyInvoiceData } from "@/lib/monthly-invoice";
import type { HaideeMonthlyInvoiceData } from "@/lib/monthly-invoice-mode-haidee";
import type { WtlMonthlyInvoiceData } from "@/lib/monthly-invoice-mode4";

export type MonthlyInvoicePrintData =
  | MonthlyInvoiceData
  | WtlMonthlyInvoiceData
  | HaideeMonthlyInvoiceData;
