"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { Printer } from "lucide-react";
import type { MarketReportData, MarketReportMode } from "@/app/actions/market-report";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MarketReportViewProps {
  mode: MarketReportMode;
  year: number;
  month: number;
  data: MarketReportData;
}

const YEAR_OPTIONS = Array.from({ length: 11 }, (_, index) => 2020 + index);

function formatCell(value: number): string {
  return value > 0 ? String(value) : "";
}

export function MarketReportView({
  mode,
  year,
  month,
  data,
}: MarketReportViewProps) {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `MarketReport-${data.mode}-${data.periodLabel}`,
  });

  function updateParams(next: {
    mode?: MarketReportMode;
    year?: number;
    month?: number;
  }) {
    const params = new URLSearchParams();
    params.set("mode", next.mode ?? mode);
    params.set("year", String(next.year ?? year));
    if ((next.mode ?? mode) === "monthly") {
      params.set("month", String(next.month ?? month));
    }
    router.push(`/market-report?${params.toString()}`);
  }

  const periodHeader = mode === "monthly" ? "日期 Date" : "月份 Month";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4 print:hidden">
        <div className="space-y-1">
          <label className="text-sm font-medium text-haidee-text">报表类型 Type</label>
          <div className="flex rounded-lg border border-haidee-border bg-white p-1">
            <button
              type="button"
              onClick={() => updateParams({ mode: "monthly" })}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                mode === "monthly"
                  ? "bg-haidee-navy text-white"
                  : "text-haidee-muted hover:bg-haidee-surface"
              )}
            >
              月度 Monthly
            </button>
            <button
              type="button"
              onClick={() => updateParams({ mode: "yearly" })}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                mode === "yearly"
                  ? "bg-haidee-navy text-white"
                  : "text-haidee-muted hover:bg-haidee-surface"
              )}
            >
              年度 Yearly
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="market-report-year"
            className="text-sm font-medium text-haidee-text"
          >
            年份 Year
          </label>
          <select
            id="market-report-year"
            value={year}
            onChange={(event) =>
              updateParams({ year: Number(event.target.value) })
            }
            className="min-h-[44px] rounded-lg border border-haidee-border bg-white px-3 text-sm"
          >
            {YEAR_OPTIONS.map((optionYear) => (
              <option key={optionYear} value={optionYear}>
                {optionYear}
              </option>
            ))}
          </select>
        </div>

        {mode === "monthly" && (
          <div className="space-y-1">
            <label
              htmlFor="market-report-month"
              className="text-sm font-medium text-haidee-text"
            >
              月份 Month
            </label>
            <select
              id="market-report-month"
              value={month}
              onChange={(event) =>
                updateParams({ month: Number(event.target.value) })
              }
              className="min-h-[44px] rounded-lg border border-haidee-border bg-white px-3 text-sm"
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map(
                (optionMonth) => (
                  <option key={optionMonth} value={optionMonth}>
                    {optionMonth}月
                  </option>
                )
              )}
            </select>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={() => handlePrint()}
          className="gap-1"
        >
          <Printer className="h-4 w-4" />
          打印 Print
        </Button>
      </div>

      <div
        ref={printRef}
        className="market-report-print min-h-0 min-w-0 flex-1 overflow-auto rounded-xl border border-haidee-border bg-white"
      >
        <div className="hidden border-b border-haidee-border px-4 py-3 print:block">
          <h3 className="text-lg font-bold text-haidee-text">
            市场报表 Market Report
          </h3>
          <p className="text-sm text-haidee-muted">
            {mode === "monthly" ? "月度 Monthly" : "年度 Yearly"} ·{" "}
            {data.periodLabel}
          </p>
        </div>

        {data.columns.length === 0 ? (
          <p className="p-8 text-center text-haidee-muted">
            所选期间暂无派车货量 No dispatch quantities for this period
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-haidee-border bg-haidee-surface text-haidee-text">
                  <th className="sticky left-0 z-10 min-w-[72px] border border-haidee-border bg-haidee-surface px-3 py-2 text-center font-semibold">
                    合计 Total
                  </th>
                  <th className="min-w-[120px] border border-haidee-border px-3 py-2 text-left font-semibold">
                    {periodHeader}
                  </th>
                  {data.columns.map((column) => (
                    <th
                      key={column.code}
                      className="min-w-[72px] border border-haidee-border px-2 py-2 text-center font-semibold"
                      title={column.header}
                    >
                      {column.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.key}
                    className={cn(
                      row.isTotal && "bg-haidee-navy/5 font-bold"
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-10 border border-haidee-border px-3 py-2 text-center font-mono",
                        row.isTotal ? "bg-haidee-navy/5" : "bg-white"
                      )}
                    >
                      {row.rowTotal > 0 ? row.rowTotal : ""}
                    </td>
                    <td className="border border-haidee-border px-3 py-2 text-left">
                      {row.label}
                    </td>
                    {data.columns.map((column) => (
                      <td
                        key={column.code}
                        className="border border-haidee-border px-2 py-2 text-center font-mono"
                      >
                        {formatCell(row.markets[column.code] ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          .market-report-print {
            border: none !important;
            overflow: visible !important;
          }

          .market-report-print table {
            font-size: 10pt;
          }

          .market-report-print th,
          .market-report-print td {
            color: #000 !important;
          }
        }
      `}</style>
    </div>
  );
}
