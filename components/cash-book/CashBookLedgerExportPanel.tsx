"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { exportCashBookLedgerCsvAction } from "@/app/actions/cash-book-ledger-statement";
import { YearMonthFields } from "@/components/shared/YearMonthFields";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CashBookLedger } from "@/lib/constants/cash-book-accounts";
import { cn } from "@/lib/utils";

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CashBookLedgerExportPanel({ book }: { book: CashBookLedger }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = now.toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(monthEnd);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const printHref = `/financial/cash-book/ledger/${book.toLowerCase()}/print?year=${year}&month=${month}`;

  function runCsvExport() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      try {
        const result = await exportCashBookLedgerCsvAction({
          book,
          fromDate,
          toDate,
        });
        downloadCsv(result.filename, result.csv);
        setMessage(`已导出 ${result.rowCount} 行交易。`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "导出失败 Export failed");
      }
    });
  }

  return (
    <section className="space-y-4 rounded-lg border bg-white p-4">
      <div>
        <h3 className="text-lg font-semibold text-haidee-text">
          月结单 / 导出 Monthly statement
        </h3>
        <p className="mt-1 text-sm text-haidee-muted">
          按月打印 PDF（含期初结转），或按日期区间下载 CSV。
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <YearMonthFields
          year={year}
          month={month}
          onYearChange={setYear}
          onMonthChange={setMonth}
        />
        <Link
          href={printHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
        >
          <Printer className="h-4 w-4" />
          打印月结单 Print
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-4 border-t border-haidee-border pt-4">
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
          onClick={() => runCsvExport()}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          下载 CSV Download
        </Button>
      </div>

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
