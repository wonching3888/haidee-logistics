import { assignDocNosForSources } from "@/lib/ar-invoice-export/ar-invoice-docno-registry";
import { fetchCrateReturnAmountsForMonthWithSkips } from "@/lib/ar-invoice-export/ar-invoice-crate-return-fetcher";
import type { SkippedCrateReturnInvoice } from "@/lib/ar-invoice-export/ar-invoice-crate-return-fetcher";
import {
  buildArInvoiceRow,
  generateArInvoiceCsv,
  type ArInvoiceRow,
} from "@/lib/ar-invoice-export/ar-invoice-row";

export interface ArCrateReturnExportPreviewRow {
  docNo: string;
  debtorCode: string;
  debtorName: string;
  amount: number;
  currency: string;
  accNo: string;
  taxType: string;
  prefix: string;
}

export interface ArCrateReturnExportPreview {
  year: number;
  month: number;
  rowCount: number;
  totalAmount: number;
  currency: string;
  docNoFirst: string | null;
  docNoLast: string | null;
  rows: ArCrateReturnExportPreviewRow[];
  skipped: SkippedCrateReturnInvoice[];
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function buildArCrateReturnExportRows(input: {
  year: number;
  month: number;
}): Promise<{
  rows: ArInvoiceRow[];
  skipped: SkippedCrateReturnInvoice[];
}> {
  const { sources, skipped } = await fetchCrateReturnAmountsForMonthWithSkips(
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
    return buildArInvoiceRow({
      docNo,
      revenueKind: "crate_return",
      debtorCode: source.debtorCode,
      debtorName: source.debtorName,
      amount: source.amount,
      year: input.year,
      month: input.month,
      currency: source.currency,
    });
  });

  return { rows, skipped };
}

export async function buildArCrateReturnExportPreview(input: {
  year: number;
  month: number;
  rows?: ArInvoiceRow[];
  skipped?: SkippedCrateReturnInvoice[];
}): Promise<ArCrateReturnExportPreview> {
  const loaded =
    input.rows != null
      ? {
          rows: input.rows,
          skipped: input.skipped ?? [],
        }
      : await buildArCrateReturnExportRows(input);

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
      amount: row.amount,
      currency: row.currency,
      accNo: row.accNo,
      taxType: row.taxType,
      prefix: row.docNo.split("-")[0] + "-",
    })),
    skipped: loaded.skipped,
  };
}

export async function buildArCrateReturnExportCsv(input: {
  year: number;
  month: number;
}): Promise<{
  filename: string;
  content: string;
  preview: ArCrateReturnExportPreview;
}> {
  const { rows, skipped } = await buildArCrateReturnExportRows(input);
  const preview = await buildArCrateReturnExportPreview({
    ...input,
    rows,
    skipped,
  });
  return {
    filename: arCrateReturnCsvFilename(input.year, input.month),
    content: generateArInvoiceCsv(rows),
    preview,
  };
}

export function arCrateReturnCsvFilename(year: number, month: number) {
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  return `ar-invoice-crate-return-${ym}.csv`;
}
