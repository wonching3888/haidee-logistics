import type { ArInvoiceRow } from "@/lib/ar-invoice-export/ar-invoice-row";
import type { MonthlyInvoiceMode } from "@/lib/constants/monthly-invoice";
import { formatInvoicePeriodLabel } from "@/lib/constants/monthly-invoice";
import { format } from "date-fns";

export type ArInvoiceListingKind = "freight" | "crate_return" | "charter";
export type ArInvoiceListingCompanyKey = "haidee" | "wtl";

export interface ArInvoiceListingSection {
  companyKey: ArInvoiceListingCompanyKey;
  rows: ArInvoiceRow[];
  totalAmount: number;
}

export interface ArInvoiceListingPrintData {
  kind: ArInvoiceListingKind;
  year: number;
  month: number;
  mode?: MonthlyInvoiceMode;
  periodLabel: string;
  generatedAtLabel: string;
  userIdLabel: string;
  currency: string;
  totalAmount: number;
  sections: ArInvoiceListingSection[];
}

export function roundArListingMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumArListingAmounts(rows: ArInvoiceRow[]): number {
  return roundArListingMoney(rows.reduce((sum, row) => sum + row.amount, 0));
}

export function resolveFreightListingCompanyKey(
  mode: MonthlyInvoiceMode
): ArInvoiceListingCompanyKey {
  return mode === "3" || mode === "4" ? "wtl" : "haidee";
}

export function formatArListingGeneratedAt(date: Date): string {
  return format(date, "dd/MM/yyyy HH:mm:ss");
}

export function buildArListingPeriodLabel(year: number, month: number): string {
  return formatInvoicePeriodLabel(year, month);
}

export function buildSingleSectionListingData(input: {
  companyKey: ArInvoiceListingCompanyKey;
  rows: ArInvoiceRow[];
}): ArInvoiceListingSection[] {
  return [
    {
      companyKey: input.companyKey,
      rows: input.rows,
      totalAmount: sumArListingAmounts(input.rows),
    },
  ];
}
