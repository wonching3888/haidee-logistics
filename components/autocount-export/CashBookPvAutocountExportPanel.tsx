"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportCashBookPvAutocountCsvAction } from "@/app/actions/cash-book-pv-autocount-export";

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CashBookPvAutocountExportPanel() {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = now.toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(monthEnd);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runExport() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      try {
        const result = await exportCashBookPvAutocountCsvAction({
          fromDate,
          toDate,
        });
        downloadCsv(result.filename, result.csv);
        setMessage(
          `已导出 ${result.rowCount} 行（白名单 6301–6306）。` +
            (result.pendingAdvanceCount > 0
              ? ` 另有 ${result.pendingAdvanceCount} 张凭证仍停在纯 3500 预支未结算。`
              : "")
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "导出失败 Export failed");
      }
    });
  }

  return (
    <section className="space-y-4 rounded-lg border bg-white p-4">
      <div>
        <h3 className="text-lg font-semibold text-haidee-text">
          现金簿付款凭证 Cash Book PV
        </h3>
        <p className="mt-1 text-sm text-haidee-muted">
          导出 MYR 已审核付款凭证明细行；仅含科目 6301–6306（司机费用结算）。纯
          3500 预支凭证会被整张跳过。
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <span className="text-sm text-haidee-muted">From</span>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <span className="text-sm text-haidee-muted">To</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-40"
          />
        </div>
        <Button
          type="button"
          className="gap-2 bg-haidee-blue text-white"
          disabled={isPending}
          onClick={() => runExport()}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          导出 CSV Export
        </Button>
      </div>

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
