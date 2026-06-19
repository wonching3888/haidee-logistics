"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getPartnerTripInvoiceTrips } from "@/app/actions/partner-trip-invoice";
import type { PartnerTripSummary } from "@/lib/partner-freight";
import { parseYearMonthFromSearchParams } from "@/lib/parse-year-month-params";
import { ReportFilterBar } from "@/components/shared/ReportFilterBar";
import { ReportAwaitingQuery } from "@/components/shared/ReportAwaitingQuery";
import { ReportFiltersChangedHint } from "@/components/shared/ReportFiltersChangedHint";
import { YearMonthFields } from "@/components/shared/YearMonthFields";
import { useReportQuery } from "@/lib/hooks/use-report-query";
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

interface PartnerTripQueryData {
  trips: PartnerTripSummary[];
  totalAmountMyr: number;
}

function formatMyr(value: number) {
  return value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PartnerTripInvoicePicker() {
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
    const result = await getPartnerTripInvoiceTrips({
      year: draft.year,
      month: draft.month,
    });
    return {
      trips: result.trips,
      totalAmountMyr: result.totalAmountMyr,
    };
  }, []);

  const buildUrlParams = useCallback((draft: YearMonthDraft) => {
    const params = new URLSearchParams();
    params.set("year", String(draft.year));
    params.set("month", String(draft.month));
    return params;
  }, []);

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
  } = useReportQuery<YearMonthDraft, PartnerTripQueryData>({
    initialDraft,
    isDraftDirty,
    fetch: fetchData,
    buildUrlParams,
    syncUrlPath: "/documents/partner-trip-invoice",
  });

  const queryParams = applied ?? draft;

  return (
    <div className="space-y-4">
      <ReportFilterBar loading={loading} onSearch={() => void search()}>
        <YearMonthFields
          year={draft.year}
          month={draft.month}
          onYearChange={(year) => setDraft((prev) => ({ ...prev, year }))}
          onMonthChange={(month) => setDraft((prev) => ({ ...prev, month }))}
          monthSuffix=""
        />
      </ReportFilterBar>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <ReportFiltersChangedHint show={filtersDirty} />

      {!hasQueried && !loading && (
        <ReportAwaitingQuery>
          请选择年份与月份，点击「查询」加载合作伙伴车力单列表。
          <br />
          Select year and month, then click Search.
        </ReportAwaitingQuery>
      )}

      {hasQueried && data && (
        <>
          <div className="text-sm text-haidee-muted">
            合计 Total: <strong>{formatMyr(data.totalAmountMyr)} MYR</strong> ·{" "}
            {data.trips.length} 趟
          </div>

          {data.trips.length === 0 ? (
            <p className="text-sm text-haidee-muted">
              该月暂无 SKTN 合作伙伴回桶记录 No partner crate return trips this month.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期 Date</TableHead>
                  <TableHead>车牌 Plate</TableHead>
                  <TableHead>市场 Market</TableHead>
                  <TableHead className="text-right">SKTN 数量</TableHead>
                  <TableHead className="text-right">单价 Rate</TableHead>
                  <TableHead className="text-right">金额 Amount</TableHead>
                  <TableHead>发票号 Invoice</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.trips.map((trip) => (
                  <TableRow key={trip.tripKey}>
                    <TableCell>{trip.tripDateLabel}</TableCell>
                    <TableCell className="font-mono">{trip.truckPlate}</TableCell>
                    <TableCell>{trip.marketLabel}</TableCell>
                    <TableCell className="text-right">{trip.quantity}</TableCell>
                    <TableCell className="text-right">
                      {trip.unitRateMyr.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMyr(trip.amountMyr)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {trip.invoiceNo ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        className="inline-flex h-8 items-center justify-center rounded-md border border-haidee-border px-3 text-sm font-medium hover:bg-haidee-border/20"
                        href={`/documents/partner-trip-invoice/print?year=${queryParams.year}&month=${queryParams.month}&tripDate=${encodeURIComponent(trip.tripDateInput)}&truckId=${trip.truckId}&marketId=${trip.marketId}&crateType=${trip.crateType}`}
                      >
                        打印 Print
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
