"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getCharterInvoiceTripsForMonth } from "@/app/actions/charter";
import { ReportFilterBar } from "@/components/shared/ReportFilterBar";
import { ReportAwaitingQuery } from "@/components/shared/ReportAwaitingQuery";
import { ReportFiltersChangedHint } from "@/components/shared/ReportFiltersChangedHint";
import { YearMonthFields } from "@/components/shared/YearMonthFields";
import { useReportQuery } from "@/lib/hooks/use-report-query";
import { parseYearMonthFromSearchParams } from "@/lib/parse-year-month-params";
import { formatMoneyAmount } from "@/lib/number-format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface YearMonthDraft {
  year: number;
  month: number;
}

interface CharterInvoiceQueryData {
  trips: Awaited<ReturnType<typeof getCharterInvoiceTripsForMonth>>["trips"];
  totalAmountMyr: number;
}


interface CharterInvoicePickerProps {
  /** When true, year/month filter is owned by the parent tab hub (not rendered here). */
  sharedYearMonth?: boolean;
}

export function CharterInvoicePicker({
  sharedYearMonth = false,
}: CharterInvoicePickerProps) {
  const searchParams = useSearchParams();

  const initialDraft = useMemo(
    () => parseYearMonthFromSearchParams(searchParams),
    [searchParams]
  );

  const isDraftDirty = useCallback(
    (draft: YearMonthDraft, applied: YearMonthDraft | null) => {
      if (!applied) return false;
      return draft.year !== applied.year || draft.month !== applied.month;
    },
    []
  );

  const fetchData = useCallback(async (draft: YearMonthDraft) => {
    return getCharterInvoiceTripsForMonth({
      year: draft.year,
      month: draft.month,
    });
  }, []);

  const buildUrlParams = useCallback((draft: YearMonthDraft) => {
    const params = new URLSearchParams();
    params.set("year", String(draft.year));
    params.set("month", String(draft.month));
    params.set("tab", "charter");
    const mode = searchParams.get("mode");
    if (mode) params.set("mode", mode);
    return params;
  }, [searchParams]);

  const {
    draft,
    setDraft,
    applied,
    data,
    loading,
    error,
    hasQueried,
    filtersDirty,
    search,
  } = useReportQuery<YearMonthDraft, CharterInvoiceQueryData>({
    initialDraft,
    isDraftDirty,
    fetch: fetchData,
    buildUrlParams,
    syncUrlPath: "/documents/monthly-invoice",
  });

  const queryParams = applied ?? draft;
  const returnTo = `/documents/monthly-invoice?year=${queryParams.year}&month=${queryParams.month}&tab=charter`;

  useEffect(() => {
    if (!sharedYearMonth) return;
    const { year, month } = parseYearMonthFromSearchParams(searchParams);
    setDraft({ year, month });
  }, [searchParams, sharedYearMonth, setDraft]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-haidee-muted">
        按月份列出包车单，打印/查看发票（HAIDEE INVOICE 或 WTL TAX INVOICE）。
        List charter trips for the selected month; open the existing charter invoice print page.
      </p>

      {!sharedYearMonth && (
        <ReportFilterBar loading={loading} onSearch={() => void search()}>
          <YearMonthFields
            year={draft.year}
            month={draft.month}
            onYearChange={(year) => setDraft((prev) => ({ ...prev, year }))}
            onMonthChange={(month) => setDraft((prev) => ({ ...prev, month }))}
            monthSuffix=""
          />
        </ReportFilterBar>
      )}

      {sharedYearMonth && (
        <ReportFilterBar loading={loading} onSearch={() => void search()}>
          <span className="text-sm text-haidee-muted">
            月份 Year/Month：{draft.year}年{draft.month}月（与上方筛选一致）
          </span>
        </ReportFilterBar>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <ReportFiltersChangedHint show={filtersDirty} />

      {!hasQueried && !loading && (
        <ReportAwaitingQuery>
          请选择年份与月份，点击「查询」加载当月包车单列表。
          <br />
          Select year and month, then click Search.
        </ReportAwaitingQuery>
      )}

      {hasQueried && data && (
        <>
          <div className="text-sm text-haidee-muted">
            合计 Total: <strong>{formatMoneyAmount(data.totalAmountMyr)} MYR</strong> ·{" "}
            {data.trips.length} 单
          </div>

          {data.trips.length === 0 ? (
            <p className="text-sm text-haidee-muted">
              该月暂无包车记录 No charter trips this month.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>包车单号 Charter No</TableHead>
                  <TableHead>日期 Date</TableHead>
                  <TableHead>车牌 Plate</TableHead>
                  <TableHead>客户 Customer</TableHead>
                  <TableHead>开票公司 Billing</TableHead>
                  <TableHead className="text-right">金额 Amount</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.trips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell className="font-mono">{trip.charterNo}</TableCell>
                    <TableCell>{trip.dateLabel}</TableCell>
                    <TableCell className="font-mono">{trip.truckPlate}</TableCell>
                    <TableCell>{trip.billToDisplayLabel ?? "—"}</TableCell>
                    <TableCell>{trip.billingCompanyLabel}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMoneyAmount(trip.amountMyr)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        className="inline-flex h-8 items-center justify-center rounded-md border border-haidee-blue px-3 text-sm font-medium text-haidee-blue hover:bg-haidee-blue/10"
                        href={`/charter/${trip.id}/invoice?returnTo=${encodeURIComponent(returnTo)}`}
                      >
                        打印发票 Print
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
