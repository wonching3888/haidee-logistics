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
import {
  exportPayrollJvCsvAction,
  getPayrollJvPreview,
} from "@/app/actions/driver-payroll";
import { cn } from "@/lib/utils";

interface PayrollJvExportPanelProps {
  year: number;
  month: number;
  isPending: boolean;
}

type PreviewData = Awaited<ReturnType<typeof getPayrollJvPreview>>;

function money(value: number) {
  return value.toFixed(2);
}

export function PayrollJvExportPanel({
  year,
  month,
  isPending: parentPending,
}: PayrollJvExportPanelProps) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function loadPreview() {
    startTransition(async () => {
      setError(null);
      try {
        const result = await getPayrollJvPreview({ year, month });
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
        const result = await exportPayrollJvCsvAction({ year, month });
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

  const busy = isPending || parentPending;
  const canExport = preview?.allBalanced === true;

  return (
    <section className="space-y-4 rounded-xl border border-haidee-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">导出 JV Export Journal Voucher</h3>
          <p className="mt-1 text-sm text-haidee-muted">
            按司机生成借贷平衡 JV，导出 AutoCount 通用 CSV（每司机一张 JV）。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={busy}
            onClick={loadPreview}
          >
            {isPending && !preview ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            预览 JV Preview
          </Button>
          <Button
            type="button"
            className="gap-2 bg-haidee-blue text-white"
            disabled={busy || !canExport}
            onClick={handleExport}
          >
            <Download className="h-4 w-4" />
            导出 CSV Export
          </Button>
        </div>
      </div>

      {preview && !preview.allBalanced && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          存在借贷不平衡的司机，请先核对后再导出。Unbalanced JV entries detected —
          export disabled.
        </p>
      )}

      {preview?.skippedDrivers.length ? (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">已跳过 Skipped (无科目后缀):</p>
          <ul className="mt-1 list-inside list-disc">
            {preview.skippedDrivers.map((driver) => (
              <li key={driver.driverId}>
                {driver.driverName} — {driver.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview ? (
        <div className="overflow-x-auto rounded-lg border border-haidee-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead>JV号</TableHead>
                <TableHead>司机</TableHead>
                <TableHead>后缀</TableHead>
                <TableHead className="text-right">借方合计 Debit</TableHead>
                <TableHead className="text-right">贷方合计 Credit</TableHead>
                <TableHead>平衡</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.drivers.map((row) => (
                <TableRow key={row.driverId}>
                  <TableCell className="font-mono text-sm">{row.jvNo}</TableCell>
                  <TableCell>{row.driverName}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {row.accountCodeSuffix}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {money(row.debitTotal)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {money(row.creditTotal)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        row.balanced ? "text-emerald-700" : "text-haidee-red"
                      )}
                    >
                      {row.balanced
                        ? "平衡 OK"
                        : `不平衡 ${money(row.imbalance)}`}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}
    </section>
  );
}
