"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getCrateReturnMonthlyInvoices } from "@/app/actions/crate-return-invoice";
import type { CrateReturnMonthlyInvoiceSummary } from "@/lib/crate-return-billing";
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

interface CrateReturnQueryData {
  invoices: CrateReturnMonthlyInvoiceSummary[];
  totalAmountMyr: number;
}

function formatMyr(value: number) {
  return value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CrateReturnMonthlyInvoicePicker() {
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
    const result = await getCrateReturnMonthlyInvoices({
      year: draft.year,
      month: draft.month,
    });
    return {
      invoices: result.invoices,
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
  } = useReportQuery<YearMonthDraft, CrateReturnQueryData>({
    initialDraft,
    isDraftDirty,
    fetch: fetchData,
    buildUrlParams,
    syncUrlPath: "/documents/crate-return-invoice",
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
          请选择年份与月份，点击「查询」加载回收桶月结单列表。
          <br />
          Select year and month, then click Search.
        </ReportAwaitingQuery>
      )}

      {hasQueried && data && (
        <>
          <div className="text-sm text-haidee-muted">
            合计 Total: <strong>{formatMyr(data.totalAmountMyr)} MYR</strong> ·{" "}
            {data.invoices.length} 张
          </div>

          {data.invoices.length === 0 ? (
            <p className="text-sm text-haidee-muted">
              该月暂无 GLY/GKS 回收桶月结记录 No crate return monthly invoices this month.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>桶型 Type</TableHead>
                  <TableHead>Bill To</TableHead>
                  <TableHead className="text-right">数量 Qty</TableHead>
                  <TableHead className="text-right">车力 Freight</TableHead>
                  <TableHead className="text-right">收桶 Collection</TableHead>
                  <TableHead className="text-right">合计 Total</TableHead>
                  <TableHead>发票号 Invoice</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invoices.map((invoice) => (
                  <TableRow key={invoice.invoiceId}>
                    <TableCell className="font-mono">{invoice.crateType}</TableCell>
                    <TableCell>
                      <div>{invoice.billToName}</div>
                      <div className="text-xs text-haidee-muted">
                        {invoice.billToCode}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{invoice.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatMyr(invoice.freightAmountMyr)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMyr(invoice.collectionAmountMyr)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMyr(invoice.totalAmountMyr)}
                    </TableCell>
                    <TableCell className="font-mono">{invoice.invoiceNo}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        className="inline-flex h-8 items-center justify-center rounded-md border border-haidee-blue px-3 text-sm font-medium text-haidee-blue hover:bg-haidee-blue/10"
                        href={`/documents/crate-return-invoice/print?year=${queryParams.year}&month=${queryParams.month}&crateType=${encodeURIComponent(invoice.crateType)}`}
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
