"use client";

import { useState, useTransition } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { YearMonthFields } from "@/components/shared/YearMonthFields";
import {
  exportArCharterCsvAction,
  getArCharterExportPreview,
} from "@/app/actions/ar-invoice-export";
import { formatDisplay } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

type PreviewData = Awaited<ReturnType<typeof getArCharterExportPreview>>;

function money(value: number) {
  return value.toFixed(2);
}

export function ArInvoiceCharterExportPanel() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function loadPreview() {
    startTransition(async () => {
      setError(null);
      try {
        const result = await getArCharterExportPreview({ year, month });
        setPreview(result);
      } catch (e) {
        setPreview(null);
        setError(e instanceof Error ? e.message : "预览失败 Preview failed");
      }
    });
  }

  function handleExport() {
    startTransition(async () => {
      setError(null);
      try {
        const result = await exportArCharterCsvAction({ year, month });
        setPreview(result.preview);
        const blob = new Blob([result.content], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.filename;
        link.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "导出失败 Export failed");
      }
    });
  }

  const canExport = preview != null && preview.rowCount > 0;

  return (
    <section className="space-y-4 rounded-xl border border-haidee-border bg-white p-4">
      <div>
        <h3 className="font-semibold">包车导出 Charter AR Export</h3>
        <p className="mt-1 text-sm text-haidee-muted">
          按月份导出包车 AR CSV（金额与收账 / 打印页同源；无客户 code 的趟次跳过）。
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <YearMonthFields
          year={year}
          month={month}
          onYearChange={setYear}
          onMonthChange={setMonth}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={isPending}
            onClick={loadPreview}
          >
            {isPending && !preview ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            预览 Preview
          </Button>
          <Button
            type="button"
            className="gap-2 bg-haidee-blue text-white"
            disabled={isPending || !canExport}
            onClick={handleExport}
          >
            <Download className="h-4 w-4" />
            导出 CSV Export
          </Button>
        </div>
      </div>

      {preview ? (
        <div className="rounded-md bg-haidee-surface px-4 py-3 text-sm">
          <p>
            <span className="font-medium">趟数 Trips:</span> {preview.rowCount}
            {" · "}
            <span className="font-medium">合计 Total:</span>{" "}
            {money(preview.totalAmount)} {preview.currency}
            {preview.docNoFirst && preview.docNoLast ? (
              <>
                {" · "}
                <span className="font-medium">单号 DocNo:</span>{" "}
                {preview.docNoFirst} ~ {preview.docNoLast}
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {preview && preview.skipped.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">
            已跳过无 code 客户 Skipped ({preview.skipped.length})
          </p>
          <ul className="mt-1 list-inside list-disc">
            {preview.skipped.map((item) => (
              <li key={item.entityKey}>
                {item.customerName}
                {item.charterNo ? ` [${item.charterNo}]` : ""} ·{" "}
                {formatDisplay(item.tripDate)}: {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview && preview.rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-haidee-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead>DocNo</TableHead>
                <TableHead>趟日期 Date</TableHead>
                <TableHead>DebtorCode</TableHead>
                <TableHead>客户 Customer</TableHead>
                <TableHead>科目 AccNo</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((row) => (
                <TableRow key={row.docNo}>
                  <TableCell className="font-mono text-sm">{row.docNo}</TableCell>
                  <TableCell>{formatDisplay(row.tripDate)}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {row.debtorCode}
                  </TableCell>
                  <TableCell>{row.debtorName}</TableCell>
                  <TableCell className="font-mono text-sm">{row.accNo}</TableCell>
                  <TableCell className="text-right font-mono">
                    {money(row.amount)} {row.currency}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : preview ? (
        <p className="text-sm text-haidee-muted">该月无可导出的包车 Invoice。</p>
      ) : null}

      {error && (
        <p className={cn("rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red")}>
          {error}
        </p>
      )}
    </section>
  );
}
