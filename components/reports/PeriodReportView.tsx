"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { Printer } from "lucide-react";
import type {
  PeriodReportData,
  PeriodReportMode,
} from "@/lib/reports/period-report-shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getMatrixTableScrollStyle } from "@/lib/table-scroll";
import { ReportFilterBar } from "@/components/shared/ReportFilterBar";
import { ReportAwaitingQuery } from "@/components/shared/ReportAwaitingQuery";
import { ReportFiltersChangedHint } from "@/components/shared/ReportFiltersChangedHint";
import { REPORT_YEAR_OPTIONS } from "@/lib/reports/report-query-params";
import { withReportQueryFlag } from "@/lib/reports/report-query-params";
import type { PdfSharePayload } from "@/lib/print-pdf-share";

const PrintPdfSharePrototype = dynamic(
  () =>
    import("@/components/documents/PrintPdfSharePrototype").then(
      (mod) => mod.PrintPdfSharePrototype
    ),
  { ssr: false }
);

interface PeriodReportDraft {
  mode: PeriodReportMode;
  year: number;
  month: number;
}

interface PeriodReportViewProps {
  basePath: string;
  reportTitle: string;
  reportTitleEn: string;
  emptyMessage: string;
  documentTitlePrefix: string;
  awaitingQueryMessage: ReactNode;
  mode: PeriodReportMode;
  year: number;
  month: number;
  data: PeriodReportData | null;
  queried: boolean;
}

const PERIOD_COL_CLASS = "min-w-[120px] max-w-[120px] w-[120px]";
const TOTAL_COL_CLASS = "min-w-[72px] max-w-[72px] w-[72px]";

const tableScrollStyle = getMatrixTableScrollStyle(260);

function formatCell(value: number): string {
  return value > 0 ? String(value) : "";
}

function isDraftDirty(
  draft: PeriodReportDraft,
  applied: PeriodReportDraft | null
): boolean {
  if (!applied) return false;
  return (
    draft.mode !== applied.mode ||
    draft.year !== applied.year ||
    draft.month !== applied.month
  );
}

export function PeriodReportView({
  basePath,
  reportTitle,
  reportTitleEn,
  emptyMessage,
  documentTitlePrefix,
  awaitingQueryMessage,
  mode: initialMode,
  year: initialYear,
  month: initialMonth,
  data,
  queried,
}: PeriodReportViewProps) {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<PeriodReportDraft>({
    mode: initialMode,
    year: initialYear,
    month: initialMonth,
  });
  const [navigating, setNavigating] = useState(false);

  const applied = useMemo((): PeriodReportDraft | null => {
    if (!queried || !data) return null;
    return { mode: initialMode, year: initialYear, month: initialMonth };
  }, [data, initialMode, initialMonth, initialYear, queried]);

  const filtersDirty = isDraftDirty(draft, applied);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: data
      ? `${documentTitlePrefix}-${data.mode}-${data.periodLabel}`
      : documentTitlePrefix,
  });

  function handleSearch() {
    setNavigating(true);
    const params = new URLSearchParams();
    params.set("mode", draft.mode);
    params.set("year", String(draft.year));
    if (draft.mode === "monthly") {
      params.set("month", String(draft.month));
    }
    router.push(`${basePath}?${withReportQueryFlag(params).toString()}`);
  }

  const periodHeader = draft.mode === "monthly" ? "日期 Date" : "月份 Month";

  const sharePayload = useMemo((): PdfSharePayload | null => {
    if (!data) return null;
    return {
      fileName: `${documentTitlePrefix}-${data.mode}-${data.periodLabel}.pdf`,
      title: `${reportTitle} ${reportTitleEn}`,
      text: `${reportTitle} · ${data.periodLabel}`,
    };
  }, [data, documentTitlePrefix, reportTitle, reportTitleEn]);

  const stickyPeriodHead =
    "sticky left-0 top-0 z-30 border border-haidee-border bg-haidee-surface px-3 py-2 text-left font-semibold";
  const stickyTotalHead =
    "sticky left-[120px] top-0 z-30 border border-haidee-border bg-haidee-surface px-3 py-2 text-center font-semibold";
  const stickyDataHead =
    "sticky top-0 z-20 border border-haidee-border bg-haidee-surface px-2 py-2 text-center font-semibold";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <ReportFilterBar
        loading={navigating}
        onSearch={handleSearch}
        actions={
          data && sharePayload ? (
            <div className="flex flex-wrap items-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handlePrint()}
                className="gap-1"
              >
                <Printer className="h-4 w-4" />
                打印 Print
              </Button>
              <PrintPdfSharePrototype
                getContentElement={() => printRef.current}
                payload={sharePayload}
              />
            </div>
          ) : undefined
        }
      >
        <div className="space-y-1">
          <label className="text-sm font-medium text-haidee-text">报表类型 Type</label>
          <div className="flex rounded-lg border border-haidee-border bg-white p-1">
            <button
              type="button"
              onClick={() => setDraft((prev) => ({ ...prev, mode: "monthly" }))}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                draft.mode === "monthly"
                  ? "bg-haidee-blue text-white"
                  : "text-haidee-muted hover:bg-haidee-surface"
              )}
            >
              月度 Monthly
            </button>
            <button
              type="button"
              onClick={() => setDraft((prev) => ({ ...prev, mode: "yearly" }))}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                draft.mode === "yearly"
                  ? "bg-haidee-blue text-white"
                  : "text-haidee-muted hover:bg-haidee-surface"
              )}
            >
              年度 Yearly
            </button>
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-haidee-text">年份 Year</span>
          <select
            id={`${documentTitlePrefix}-year`}
            value={draft.year}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, year: Number(event.target.value) }))
            }
            className="min-h-[44px] rounded-lg border border-haidee-border bg-white px-3 text-sm"
          >
            {REPORT_YEAR_OPTIONS.map((optionYear) => (
              <option key={optionYear} value={optionYear}>
                {optionYear}
              </option>
            ))}
          </select>
        </label>

        {draft.mode === "monthly" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-haidee-text">月份 Month</span>
            <select
              id={`${documentTitlePrefix}-month`}
              value={draft.month}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  month: Number(event.target.value),
                }))
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
          </label>
        )}
      </ReportFilterBar>

      <ReportFiltersChangedHint show={filtersDirty} />

      {!queried && !navigating && (
        <ReportAwaitingQuery>{awaitingQueryMessage}</ReportAwaitingQuery>
      )}

      {queried && data && (
        <div
          ref={printRef}
          className="period-report-print flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-haidee-border bg-white"
        >
          <div className="hidden shrink-0 border-b border-haidee-border px-4 py-3 print:block">
            <h3 className="text-lg font-bold text-haidee-text">
              {reportTitle} {reportTitleEn}
            </h3>
            <p className="text-sm text-haidee-muted">
              {data.mode === "monthly" ? "月度 Monthly" : "年度 Yearly"} ·{" "}
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
                        总桶数 Barrels
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
                            {row.isTotal ? (
                              <div className="space-y-0.5">
                                <div>{row.rowTotal > 0 ? row.rowTotal : ""}</div>
                                {row.rowBoxTotal > 0 && (
                                  <div className="text-xs font-normal text-haidee-muted">
                                    +{row.rowBoxTotal}盒
                                  </div>
                                )}
                              </div>
                            ) : row.rowTotal > 0 ? (
                              row.rowTotal
                            ) : (
                              ""
                            )}
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

          {data.columns.length > 0 && (
            <div className="shrink-0 border-t border-haidee-border px-4 py-3 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono">
                <span>
                  总桶数 Total Barrels:{" "}
                  <strong>{data.grandTotalBarrels.toLocaleString("en-MY")}</strong>
                </span>
                <span>
                  总盒子 Total Boxes:{" "}
                  <strong>{data.grandTotalBoxes.toLocaleString("en-MY")}</strong>
                </span>
                <span className="text-haidee-muted">
                  合计 {data.grandTotal.toLocaleString("en-MY")}（桶+盒）
                </span>
              </div>
            </div>
          )}
        </div>
      )}

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
