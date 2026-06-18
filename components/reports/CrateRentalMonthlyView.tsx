"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CrateRentalMonthlyReport } from "@/lib/crate-rental-monthly-report";

const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => 2020 + i);

function formatAmount(value: number, currency: "MYR" | "THB") {
  return `${value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatMyr(value: number) {
  return `${value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MYR`;
}

interface CrateRentalMonthlyViewProps {
  initialYear: number;
  initialMonth: number;
  onLoad: (input: {
    year: number;
    month: number;
  }) => Promise<CrateRentalMonthlyReport>;
}

export function CrateRentalMonthlyView({
  initialYear,
  initialMonth,
  onLoad,
}: CrateRentalMonthlyViewProps) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<CrateRentalMonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    try {
      const report = await onLoad({ year, month });
      setData(report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-haidee-text">年份 Year</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="min-h-[44px] rounded-lg border border-haidee-border px-3"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-haidee-text">月份 Month</span>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="min-h-[44px] rounded-lg border border-haidee-border px-3"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={loading}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-haidee-blue px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          查询 Search
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      {!data && !loading && !error && (
        <p className="text-sm text-haidee-muted">
          请选择年月后点击「查询」加载租桶月结数据。
        </p>
      )}

      {data && (
        <>
          <p className="text-sm text-haidee-muted">
            {data.yearMonth} · 汇率 Exchange rate: 1 MYR = {data.exchangeRate}{" "}
            THB（THB 金额换算：THB ÷ {data.exchangeRate} = MYR）
          </p>
          <div className="overflow-x-auto rounded-xl border border-haidee-border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>桶型</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">单价</TableHead>
                  <TableHead className="text-right">原币金额</TableHead>
                  <TableHead className="text-right">折合 MYR</TableHead>
                  <TableHead>备注</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.crateType}>
                    <TableCell className="font-mono font-medium">
                      {row.crateType}
                    </TableCell>
                    <TableCell className="text-right">{row.quantity}</TableCell>
                    <TableCell className="text-right font-mono">
                      {row.rate > 0
                        ? `${row.rate.toFixed(2)} ${row.currency}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.amountOriginal > 0
                        ? formatAmount(row.amountOriginal, row.currency)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMyr(row.amountMyr)}
                    </TableCell>
                    <TableCell className="text-haidee-muted">
                      {row.notes ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-haidee-surface font-semibold">
                  <TableCell>合计 Total</TableCell>
                  <TableCell className="text-right">
                    {data.totals.quantity}
                  </TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right font-mono">
                    {formatMyr(data.totals.amountMyr)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
