"use client";

import type { CSSProperties } from "react";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { Printer } from "lucide-react";
import type {
  PeriodReportData,
  PeriodReportMode,
} from "@/lib/reports/period-report-shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PeriodReportViewProps {
  basePath: string;
  reportTitle: string;
  reportTitleEn: string;
  emptyMessage: string;
  documentTitlePrefix: string;
  mode: PeriodReportMode;
  year: number;
  month: number;
  data: PeriodReportData;
}

const YEAR_OPTIONS = Array.from({ length: 11 }, (_, index) => 2020 + index);

const PERIOD_COL_CLASS = "min-w-[120px] max-w-[120px] w-[120px]";
const TOTAL_COL_CLASS = "min-w-[72px] max-w-[72px] w-[72px]";

const tableScrollStyle: CSSProperties = {
  height: "calc(100vh - 260px)",
  maxHeight: "100%",
  minHeight: 0,
  overflowX: "auto",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  width: "100%",
  maxWidth: "100%",
};

function formatCell(value: number): string {
  return value > 0 ? String(value) : "";
}

export function PeriodReportView({
  basePath,
  reportTitle,
  reportTitleEn,
  emptyMessage,
  documentTitlePrefix,
  mode,
  year,
  month,
  data,
}: PeriodReportViewProps) {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${documentTitlePrefix}-${data.mode}-${data.periodLabel}`,
  });

  function updateParams(next: {
    mode?: PeriodReportMode;
    year?: number;
    month?: number;
  }) {
    const params = new URLSearchParams();
    params.set("mode", next.mode ?? mode);
    params.set("year", String(next.year ?? year));
    if ((next.mode ?? mode) === "monthly") {
      params.set("month", String(next.month ?? month));
    }
    router.push(`${basePath}?${params.toString()}`);
  }

  const periodHeader = mode === "monthly" ? "日期 Date" : "月份 Month";

  const stickyPeriodHead =
    "sticky left-0 top-0 z-30 border border-haidee-border bg-haidee-surface px-3 py-2 text-left font-semibold";
  const stickyTotalHead =
    "sticky left-[120px] top-0 z-30 border border-haidee-border bg-haidee-surface px-3 py-2 text-center font-semibold";
  const stickyDataHead =
    "sticky top-0 z-20 border border-haidee-border bg-haidee-surface px-2 py-2 text-center font-semibold";

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
            htmlFor={`${documentTitlePrefix}-year`}
            className="text-sm font-medium text-haidee-text"
          >
            年份 Year
          </label>
          <select
            id={`${documentTitlePrefix}-year`}
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
              htmlFor={`${documentTitlePrefix}-month`}
              className="text-sm font-medium text-haidee-text"
            >
              月份 Month
            </label>
            <select
              id={`${documentTitlePrefix}-month`}
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
        className="period-report-print flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-haidee-border bg-white"
      >
        <div className="hidden shrink-0 border-b border-haidee-border px-4 py-3 print:block">
          <h3 className="text-lg font-bold text-haidee-text">
            {reportTitle} {reportTitleEn}
          </h3>
          <p className="text-sm text-haidee-muted">
            {mode === "monthly" ? "月度 Monthly" : "年度 Yearly"} ·{" "}
            {data.periodLabel}
          </p>
        </div>

        {data.columns.length === 0 ? (
          <p className="p-8 text-center text-haidee-muted">{emptyMessage}</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="period-report-scroll" style={tableScrollStyle}>
              <table className="min-w-max border-collapse text-sm">
                <thead>
                  <tr className="text-haidee-text">
                    <th className={cn(stickyPeriodHead, PERIOD_COL_CLASS)}>
                      {periodHeader}
                    </th>
                    <th className={cn(stickyTotalHead, TOTAL_COL_CLASS)}>
                      合计 Total
                    </th>
                    {data.columns.map((column) => (
                      <th
                        key={column.code}
                        className={cn(stickyDataHead, "min-w-[72px]")}
                        title={column.header}
                      >
                        {column.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const stickyBg = row.isTotal ? "bg-haidee-navy/5" : "bg-white";

                    return (
                      <tr
                        key={row.key}
                        className={cn(row.isTotal && "font-bold")}
                      >
                        <td
                          className={cn(
                            "sticky left-0 z-10 border border-haidee-border px-3 py-2 text-left",
                            PERIOD_COL_CLASS,
                            stickyBg
                          )}
                        >
                          {row.label}
                        </td>
                        <td
                          className={cn(
                            "sticky left-[120px] z-10 border border-haidee-border px-3 py-2 text-center font-mono",
                            TOTAL_COL_CLASS,
                            stickyBg
                          )}
                        >
                          {row.rowTotal > 0 ? row.rowTotal : ""}
                        </td>
                        {data.columns.map((column) => (
                          <td
                            key={column.code}
                            className={cn(
                              "border border-haidee-border px-2 py-2 text-center font-mono",
                              row.isTotal && "bg-haidee-navy/5"
                            )}
                          >
                            {formatCell(row.values[column.code] ?? 0)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          .period-report-print {
            border: none !important;
            overflow: visible !important;
          }

          .period-report-scroll {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }

          .period-report-print table {
            font-size: 10pt;
          }

          .period-report-print th,
          .period-report-print td {
            color: #000 !important;
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}
