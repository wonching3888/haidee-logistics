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
  exportStaffPayrollJvCsvAction,
  getStaffPayrollJvPreview,
} from "@/app/actions/staff-payroll";
import { cn } from "@/lib/utils";

interface StaffPayrollJvExportPanelProps {
  year: number;
  month: number;
  isPending?: boolean;
}

type PreviewData = Awaited<ReturnType<typeof getStaffPayrollJvPreview>>;

function money(value: number) {
  return value.toFixed(2);
}

export function StaffPayrollJvExportPanel({
  year,
  month,
  isPending: parentPending = false,
}: StaffPayrollJvExportPanelProps) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function loadPreview() {
    startTransition(async () => {
      setError(null);
      try {
        const result = await getStaffPayrollJvPreview({ year, month });
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
        const result = await exportStaffPayrollJvCsvAction({ year, month });
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
          <h3 className="font-semibold">员工工资单 JV Staff Payroll JV</h3>
          <p className="mt-1 text-sm text-haidee-muted">
            按员工生成借贷平衡 JV（9000/9003 底薪；共用 4101/4102/4103
            汇总一行），导出 AutoCount CSV。
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
          借贷不平衡（差额 {money(preview.imbalance)}），请先核对后再导出。
        </p>
      )}

      {preview?.skippedStaff.length ? (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">已跳过 Skipped:</p>
          <ul className="mt-1 list-inside list-disc">
            {preview.skippedStaff.map((row) => (
              <li key={row.staffId}>
                {row.staffName} — {row.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview ? (
        <div className="space-y-3">
          <p className="text-sm text-haidee-muted">
            JV号 <span className="font-mono">{preview.jvNo}</span> · 借{" "}
            <span className="font-mono">{money(preview.debitTotal)}</span> · 贷{" "}
            <span className="font-mono">{money(preview.creditTotal)}</span> ·{" "}
            <span
              className={cn(
                "font-medium",
                preview.balanced ? "text-emerald-700" : "text-haidee-red"
              )}
            >
              {preview.balanced ? "平衡 OK" : "不平衡"}
            </span>
          </p>
          <div className="overflow-x-auto rounded-lg border border-haidee-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                  <TableHead>员工</TableHead>
                  <TableHead>后缀</TableHead>
                  <TableHead>类别</TableHead>
                  <TableHead className="text-right">底薪</TableHead>
                  <TableHead className="text-right">PCB</TableHead>
                  <TableHead className="text-right">实发</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.staff.map((row) => (
                  <TableRow key={row.staffId}>
                    <TableCell>{row.staffName}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {row.accountCodeSuffix}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.payrollCategory === "director_remuneration"
                        ? "董事袍金"
                        : "薪金"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {money(row.amounts.baseSalary)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {money(row.amounts.pcb)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {money(row.amounts.netSalary)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
