import type { MonthlyInvoiceMode } from "@/lib/constants/monthly-invoice";
import {
  debtorCodeToIncomeAccNo,
  resolveArTaxType,
} from "@/lib/ar-invoice-export/ar-invoice-accounts";

/** Revenue line kinds for AR export (freight / crate return / charter). */
export type ArInvoiceRevenueKind = "freight" | "crate_return" | "charter";

/**
 * AutoCount AR sales invoice import row (14 columns, Account_count.xlsx).
 * Optional columns are empty strings when not used.
 */
export interface ArInvoiceRow {
  docNo: string;
  docDate: string;
  debtorCode: string;
  debtorName: string;
  description: string;
  accNo: string;
  taxType: string;
  amount: number;
  currencyRate: string;
  refNo2: string;
  detailDescription: string;
  toAccountRate: string;
  currency: string;
  taxableAmt: string;
}

export const AR_INVOICE_CSV_HEADERS = [
  "DocNo",
  "DocDate",
  "DebtorCode",
  "DebtorName",
  "Description",
  "AccNo",
  "TaxType",
  "Amount",
  "CurrencyRate",
  "RefNo2",
  "DetailDescription",
  "ToAccountRate",
  "Currency",
  "TaxableAmt",
] as const;

/** Batch 2/3 — one receivable invoice amount ready for AR row assembly. */
export interface ArInvoiceAmountSource {
  revenueKind: ArInvoiceRevenueKind;
  mode: MonthlyInvoiceMode | "charter";
  debtorCode: string;
  debtorName: string;
  year: number;
  month: number;
  /** Charter only — ISO date YYYY-MM-DD */
  tripDate?: string;
  amount: number;
  currency: "THB" | "MYR";
}

/**
 * Batch 2/3 — loads monthly invoice totals from the receivable pipeline.
 * Not implemented in Batch 1; signatures only.
 */
export interface ArInvoiceAmountFetcher {
  fetchFreightAmountsForMonth(
    year: number,
    month: number,
    mode: MonthlyInvoiceMode
  ): Promise<ArInvoiceAmountSource[]>;

  fetchCrateReturnAmountsForMonth(
    year: number,
    month: number,
    mode: MonthlyInvoiceMode
  ): Promise<ArInvoiceAmountSource[]>;

  fetchCharterAmountsForMonth(
    year: number,
    month: number
  ): Promise<ArInvoiceAmountSource[]>;
}

/** Monthly DocDate: 1st of month as DD/MM/YYYY (freight & crate return). */
export function formatArMonthlyDocDate(year: number, month: number): string {
  const mm = String(month).padStart(2, "0");
  return `01/${mm}/${year}`;
}

/** Charter DocDate from ISO trip date YYYY-MM-DD → DD/MM/YYYY. */
export function formatArCharterDocDate(tripDate: string): string {
  const [y, m, d] = tripDate.slice(0, 10).split("-");
  if (!y || !m || !d) {
    throw new Error(`Invalid charter trip date: ${tripDate}`);
  }
  return `${d}/${m}/${y}`;
}

export function formatArFreightDescription(year: number, month: number): string {
  return `运费 ${year}年${month}月`;
}

export function formatArCrateReturnDescription(
  year: number,
  month: number
): string {
  return `回桶费 ${year}年${month}月`;
}

/** Charter description uses trip date: 运费 YYYY-M-D (no zero-padding on month/day). */
export function formatArCharterDescription(tripDate: string): string {
  const [y, m, d] = tripDate.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid charter trip date: ${tripDate}`);
  }
  return `运费 ${y}-${m}-${d}`;
}

function resolveDescription(input: {
  revenueKind: ArInvoiceRevenueKind;
  year: number;
  month: number;
  tripDate?: string;
}): string {
  switch (input.revenueKind) {
    case "freight":
      return formatArFreightDescription(input.year, input.month);
    case "crate_return":
      return formatArCrateReturnDescription(input.year, input.month);
    case "charter":
      if (!input.tripDate) {
        throw new Error("Charter AR row requires tripDate");
      }
      return formatArCharterDescription(input.tripDate);
    default: {
      const _exhaustive: never = input.revenueKind;
      return _exhaustive;
    }
  }
}

function resolveDocDate(input: {
  revenueKind: ArInvoiceRevenueKind;
  year: number;
  month: number;
  tripDate?: string;
}): string {
  if (input.revenueKind === "charter") {
    if (!input.tripDate) {
      throw new Error("Charter AR row requires tripDate");
    }
    return formatArCharterDocDate(input.tripDate);
  }
  return formatArMonthlyDocDate(input.year, input.month);
}

export interface BuildArInvoiceRowInput {
  docNo: string;
  revenueKind: ArInvoiceRevenueKind;
  debtorCode: string;
  debtorName: string;
  amount: number;
  year: number;
  month: number;
  tripDate?: string;
  currency?: "THB" | "MYR" | "";
}

/** Assemble one AutoCount AR import row from export rules (Batch 1 — amount passed in). */
export function buildArInvoiceRow(input: BuildArInvoiceRowInput): ArInvoiceRow {
  const debtorCode = input.debtorCode.trim();
  return {
    docNo: input.docNo,
    docDate: resolveDocDate(input),
    debtorCode,
    debtorName: input.debtorName,
    description: resolveDescription(input),
    accNo: debtorCodeToIncomeAccNo(debtorCode),
    taxType: resolveArTaxType(debtorCode),
    amount: roundArAmount(input.amount),
    currencyRate: "",
    refNo2: "",
    detailDescription: "",
    toAccountRate: "",
    currency: input.currency ?? "",
    taxableAmt: "",
  };
}

function roundArAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function csvEscape(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatArAmountForCsv(amount: number): string {
  return amount.toFixed(2);
}

/** Map an ArInvoiceRow to CSV column order (14 columns). */
export function arInvoiceRowToCsvValues(row: ArInvoiceRow): string[] {
  return [
    row.docNo,
    row.docDate,
    row.debtorCode,
    row.debtorName,
    row.description,
    row.accNo,
    row.taxType,
    formatArAmountForCsv(row.amount),
    row.currencyRate,
    row.refNo2,
    row.detailDescription,
    row.toAccountRate,
    row.currency,
    row.taxableAmt,
  ];
}

/** Generate UTF-8 BOM CSV for AutoCount AR import. */
export function generateArInvoiceCsv(rows: ArInvoiceRow[]): string {
  const headerLine = AR_INVOICE_CSV_HEADERS.join(",");
  const dataLines = rows.map((row) =>
    arInvoiceRowToCsvValues(row).map(csvEscape).join(",")
  );
  return `\uFEFF${headerLine}\n${dataLines.join("\n")}\n`;
}
