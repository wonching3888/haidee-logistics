import type { MonthlyInvoiceMode } from "@/lib/constants/monthly-invoice";
import { getMonthlyInvoiceModeConfig } from "@/lib/constants/monthly-invoice";
import {
  ArDocNoSequenceAllocator,
  arDocNoPrefixForMode,
} from "@/lib/ar-invoice-export/ar-invoice-docno";
import { fetchFreightAmountsForMonth } from "@/lib/ar-invoice-export/ar-invoice-freight-fetcher";
import {
  buildArInvoiceRow,
  generateArInvoiceCsv,
  type ArInvoiceAmountSource,
  type ArInvoiceRow,
} from "@/lib/ar-invoice-export/ar-invoice-row";

/** Modes that share a DocNo prefix must export in this order (earlier modes reserve slots). */
const SHARED_PREFIX_PRIOR_MODES: Partial<
  Record<MonthlyInvoiceMode, MonthlyInvoiceMode[]>
> = {
  "1b": ["1a"],
  "4": ["3"],
};

export interface ArFreightExportPreviewRow {
  docNo: string;
  debtorCode: string;
  debtorName: string;
  amount: number;
  currency: string;
  accNo: string;
  taxType: string;
}

export interface ArFreightExportPreview {
  year: number;
  month: number;
  mode: MonthlyInvoiceMode;
  prefix: string;
  currency: string;
  rowCount: number;
  totalAmount: number;
  docNoFirst: string | null;
  docNoLast: string | null;
  rows: ArFreightExportPreviewRow[];
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function reserveSharedDocNoSlots(
  allocator: ArDocNoSequenceAllocator,
  year: number,
  month: number,
  mode: MonthlyInvoiceMode
) {
  const prefix = arDocNoPrefixForMode(mode);
  const priorModes = SHARED_PREFIX_PRIOR_MODES[mode] ?? [];
  for (const priorMode of priorModes) {
    const priorSources = await fetchFreightAmountsForMonth(
      year,
      month,
      priorMode
    );
    if (priorSources.length === 0) continue;
    allocator.allocateForDebtors(
      prefix,
      priorSources.map((source) => source.debtorCode)
    );
  }
}

export async function assignFreightDocNos(
  year: number,
  month: number,
  mode: MonthlyInvoiceMode,
  sources: ArInvoiceAmountSource[]
): Promise<Map<string, string>> {
  const allocator = new ArDocNoSequenceAllocator(year, month);
  const prefix = arDocNoPrefixForMode(mode);
  await reserveSharedDocNoSlots(allocator, year, month, mode);
  return allocator.allocateForDebtors(
    prefix,
    sources.map((source) => source.debtorCode)
  );
}

export async function buildArFreightExportRows(input: {
  year: number;
  month: number;
  mode: MonthlyInvoiceMode;
}): Promise<ArInvoiceRow[]> {
  const sources = await fetchFreightAmountsForMonth(
    input.year,
    input.month,
    input.mode
  );
  const docNoByDebtor = await assignFreightDocNos(
    input.year,
    input.month,
    input.mode,
    sources
  );

  return sources.map((source) => {
    const docNo = docNoByDebtor.get(source.debtorCode);
    if (!docNo) {
      throw new Error(`Missing DocNo for debtor ${source.debtorCode}`);
    }
    return buildArInvoiceRow({
      docNo,
      revenueKind: "freight",
      debtorCode: source.debtorCode,
      debtorName: source.debtorName,
      amount: source.amount,
      year: input.year,
      month: input.month,
      currency: source.currency,
    });
  });
}

export async function buildArFreightExportPreview(input: {
  year: number;
  month: number;
  mode: MonthlyInvoiceMode;
  rows?: ArInvoiceRow[];
}): Promise<ArFreightExportPreview> {
  const modeConfig = getMonthlyInvoiceModeConfig(input.mode);
  const rows =
    input.rows ??
    (await buildArFreightExportRows({
      year: input.year,
      month: input.month,
      mode: input.mode,
    }));
  const totalAmount = roundMoney(rows.reduce((sum, row) => sum + row.amount, 0));

  return {
    year: input.year,
    month: input.month,
    mode: input.mode,
    prefix: arDocNoPrefixForMode(input.mode),
    currency: modeConfig?.currency ?? rows[0]?.currency ?? "MYR",
    rowCount: rows.length,
    totalAmount,
    docNoFirst: rows[0]?.docNo ?? null,
    docNoLast: rows.length > 0 ? rows[rows.length - 1]!.docNo : null,
    rows: rows.map((row) => ({
      docNo: row.docNo,
      debtorCode: row.debtorCode,
      debtorName: row.debtorName,
      amount: row.amount,
      currency: row.currency,
      accNo: row.accNo,
      taxType: row.taxType,
    })),
  };
}

export async function buildArFreightExportCsv(input: {
  year: number;
  month: number;
  mode: MonthlyInvoiceMode;
}): Promise<{ filename: string; content: string; preview: ArFreightExportPreview }> {
  const rows = await buildArFreightExportRows(input);
  const preview = await buildArFreightExportPreview({ ...input, rows });
  return {
    filename: arFreightCsvFilename(input.year, input.month, input.mode),
    content: generateArInvoiceCsv(rows),
    preview,
  };
}

export function arFreightCsvFilename(
  year: number,
  month: number,
  mode: MonthlyInvoiceMode
) {
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  return `ar-invoice-freight-${mode}-${ym}.csv`;
}
