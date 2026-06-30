import { assignDocNosForSources } from "@/lib/ar-invoice-export/ar-invoice-docno-registry";
import { fetchCharterAmountsForMonthWithSkips } from "@/lib/ar-invoice-export/ar-invoice-charter-fetcher";
import type { SkippedCharterInvoice } from "@/lib/ar-invoice-export/ar-invoice-charter-fetcher";
import {
  buildArInvoiceRow,
  generateArInvoiceCsv,
  type ArInvoiceRow,
} from "@/lib/ar-invoice-export/ar-invoice-row";

export interface ArCharterExportPreviewRow {
  docNo: string;
  debtorCode: string;
  debtorName: string;
  tripDate: string;
  amount: number;
  currency: string;
  accNo: string;
  taxType: string;
}

export interface ArCharterExportPreview {
  year: number;
  month: number;
  rowCount: number;
  totalAmount: number;
  currency: string;
  docNoFirst: string | null;
  docNoLast: string | null;
  rows: ArCharterExportPreviewRow[];
  skipped: SkippedCharterInvoice[];
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function buildArCharterExportRows(input: {
  year: number;
  month: number;
}): Promise<{
  rows: ArInvoiceRow[];
  skipped: SkippedCharterInvoice[];
}> {
  const { sources, skipped } = await fetchCharterAmountsForMonthWithSkips(
    input.year,
    input.month
  );
  const docNoByEntity = await assignDocNosForSources(
    input.year,
    input.month,
    sources
  );

  const rows = sources.map((source) => {
    const docNo = docNoByEntity.get(source.entityKey);
    if (!docNo) {
      throw new Error(`Missing DocNo for entity ${source.entityKey}`);
    }
    if (!source.tripDate) {
      throw new Error(`Charter source missing tripDate: ${source.entityKey}`);
    }
    return buildArInvoiceRow({
      docNo,
      revenueKind: "charter",
      debtorCode: source.debtorCode,
      debtorName: source.debtorName,
      amount: source.amount,
      year: input.year,
      month: input.month,
      tripDate: source.tripDate,
      currency: source.currency,
    });
  });

  return { rows, skipped };
}

export async function buildArCharterExportPreview(input: {
  year: number;
  month: number;
  rows?: ArInvoiceRow[];
  skipped?: SkippedCharterInvoice[];
}): Promise<ArCharterExportPreview> {
  const loaded =
    input.rows != null
      ? { rows: input.rows, skipped: input.skipped ?? [] }
      : await buildArCharterExportRows(input);

  const totalAmount = roundMoney(
    loaded.rows.reduce((sum, row) => sum + row.amount, 0)
  );

  return {
    year: input.year,
    month: input.month,
    rowCount: loaded.rows.length,
    totalAmount,
    currency: loaded.rows[0]?.currency ?? "MYR",
    docNoFirst: loaded.rows[0]?.docNo ?? null,
    docNoLast:
      loaded.rows.length > 0
        ? loaded.rows[loaded.rows.length - 1]!.docNo
        : null,
    rows: loaded.rows.map((row) => ({
      docNo: row.docNo,
      debtorCode: row.debtorCode,
      debtorName: row.debtorName,
      tripDate: row.description.replace(/^运费 /, ""),
      amount: row.amount,
      currency: row.currency,
      accNo: row.accNo,
      taxType: row.taxType,
    })),
    skipped: loaded.skipped,
  };
}

export async function buildArCharterExportCsv(input: {
  year: number;
  month: number;
}): Promise<{
  filename: string;
  content: string;
  preview: ArCharterExportPreview;
}> {
  const { rows, skipped } = await buildArCharterExportRows(input);
  const preview = await buildArCharterExportPreview({
    ...input,
    rows,
    skipped,
  });
  return {
    filename: arCharterCsvFilename(input.year, input.month),
    content: generateArInvoiceCsv(rows),
    preview,
  };
}

export function arCharterCsvFilename(year: number, month: number) {
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  return `ar-invoice-charter-${ym}.csv`;
}
