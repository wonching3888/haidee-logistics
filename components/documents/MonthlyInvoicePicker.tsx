"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { FileText, PlusCircle } from "lucide-react";
import { getMonthlyInvoiceCustomers } from "@/app/actions/monthly-invoice";
import { getUnpricedInboundForMonth } from "@/app/actions/unpriced-inbound";
import type { UnpricedInboundLine } from "@/lib/unpriced-inbound";
import { MonthlyInvoiceExtraChargesDialog } from "@/components/documents/MonthlyInvoiceExtraChargesDialog";
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
  MONTHLY_INVOICE_MODES,
  type MonthlyInvoiceMode,
  isMonthlyInvoiceMode,
} from "@/lib/constants/monthly-invoice";
import { parseYearMonthFromSearchParams } from "@/lib/parse-year-month-params";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { ReportFilterBar } from "@/components/shared/ReportFilterBar";
import { ReportAwaitingQuery } from "@/components/shared/ReportAwaitingQuery";
import { ReportFiltersChangedHint } from "@/components/shared/ReportFiltersChangedHint";
import { YearMonthFields } from "@/components/shared/YearMonthFields";
import { useReportQuery } from "@/lib/hooks/use-report-query";

const DOCUMENT_ACTION_BTN =
  "min-h-[44px] gap-2 px-5 text-sm font-medium bg-haidee-blue text-white hover:bg-haidee-blue/90 disabled:bg-gray-300 disabled:text-gray-500 disabled:opacity-100 disabled:hover:bg-gray-300";

interface CustomerRow {
  customerId: string;
  customerCode: string;
  customerName: string;
  tongQty: number;
  boxQty: number;
  tongAmount: number;
  boxAmount: number;
  grandTotal: number;
  lineCount: number;
}

interface MonthlyInvoiceDraft {
  year: number;
  month: number;
  mode: MonthlyInvoiceMode;
}

interface MonthlyInvoiceQueryData {
  customers: CustomerRow[];
  periodLabel: string;
  currency: string;
  unpriced: UnpricedInboundLine[];
  unpricedCount: number;
}

const MODE_DISPLAY: Record<string, string> = {
  "1a": "1a",
  "1b": "1b",
  "2": "2",
  "3": "3",
  "4": "Mode4",
  other: "其他",
};

function formatAmount(value: number, currency: string) {
  return `${value.toFixed(2)} ${currency}`;
}

interface MonthlyInvoicePickerProps {
  /** List page to return to from print view (e.g. embedded in /documents). */
  listHref?: string;
  /** Hide year/month fields when parent hub owns the shared filter. */
  sharedYearMonth?: boolean;
}

export function MonthlyInvoicePicker({
  listHref,
  sharedYearMonth = false,
}: MonthlyInvoicePickerProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const syncListUrl = pathname === "/documents/monthly-invoice";

  const initialDraft = useMemo((): MonthlyInvoiceDraft => {
    const { year, month } = parseYearMonthFromSearchParams(searchParams);
    const urlMode = searchParams.get("mode");
    return {
      year,
      month,
      mode: urlMode && isMonthlyInvoiceMode(urlMode) ? urlMode : "1a",
    };
  }, [searchParams]);

  const isDraftDirty = useCallback(
    (draft: MonthlyInvoiceDraft, applied: MonthlyInvoiceDraft | null) => {
      if (!applied) return false;
      return (
        draft.year !== applied.year ||
        draft.month !== applied.month ||
        draft.mode !== applied.mode
      );
    },
    []
  );

  const fetchData = useCallback(async (draft: MonthlyInvoiceDraft) => {
    const [result, unpricedResult] = await Promise.all([
      getMonthlyInvoiceCustomers({
        year: draft.year,
        month: draft.month,
        mode: draft.mode,
      }),
      getUnpricedInboundForMonth(draft.year, draft.month),
    ]);
    return {
      customers: result.customers,
      periodLabel: result.periodLabel,
      currency: result.mode.currency,
      unpriced: unpricedResult.lines,
      unpricedCount: unpricedResult.count,
    };
  }, []);

  const buildUrlParams = useCallback((draft: MonthlyInvoiceDraft) => {
    const params = new URLSearchParams();
    params.set("year", String(draft.year));
    params.set("month", String(draft.month));
    params.set("mode", draft.mode);
    const tab = searchParams.get("tab");
    if (tab === "charter") params.set("tab", tab);
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
  } = useReportQuery<MonthlyInvoiceDraft, MonthlyInvoiceQueryData>({
    initialDraft,
    isDraftDirty,
    fetch: fetchData,
    buildUrlParams,
    syncUrlPath: syncListUrl ? "/documents/monthly-invoice" : undefined,
    syncUrl: syncListUrl,
  });

  function openInvoice(customerId: string) {
    const params = applied ?? draft;
    const urlParams = new URLSearchParams({
      year: String(params.year),
      month: String(params.month),
      mode: params.mode,
      customerId,
    });
    if (listHref) {
      urlParams.set("returnTo", listHref);
    }
    router.push(`/documents/monthly-invoice/print?${urlParams.toString()}`);
  }

  const activeMode = MONTHLY_INVOICE_MODES.find((item) => item.value === draft.mode)!;
  const displayParams = applied ?? draft;

  useEffect(() => {
    if (!sharedYearMonth) return;
    const { year, month } = parseYearMonthFromSearchParams(searchParams);
    setDraft((prev) => ({ ...prev, year, month }));
  }, [searchParams, sharedYearMonth, setDraft]);

  const [extraChargesTarget, setExtraChargesTarget] = useState<{
    customerId: string;
    customerName: string;
    customerCode: string;
  } | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-xs text-haidee-muted">
        选择年份与月份，按五种付款模式分别生成账单。每位顾客单独一份 PDF。
        Select year/month and mode; one printable invoice per customer.
      </p>

      <ReportFilterBar loading={loading} onSearch={() => void search()}>
        {!sharedYearMonth && (
          <YearMonthFields
            year={draft.year}
            month={draft.month}
            onYearChange={(year) => setDraft((prev) => ({ ...prev, year }))}
            onMonthChange={(month) => setDraft((prev) => ({ ...prev, month }))}
          />
        )}
        {sharedYearMonth && (
          <span className="text-sm text-haidee-muted">
            月份 Year/Month：{draft.year}年{draft.month}月（与上方筛选一致）
          </span>
        )}
      </ReportFilterBar>

      <div className="flex flex-wrap gap-2">
        {MONTHLY_INVOICE_MODES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setDraft((prev) => ({ ...prev, mode: item.value }))}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              draft.mode === item.value
                ? "border-haidee-blue bg-haidee-blue/10 text-haidee-blue"
                : "border-haidee-border bg-white hover:bg-haidee-surface/60"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {hasQueried && data && (
        <div className="rounded-lg border border-haidee-border bg-haidee-surface/40 px-4 py-3 text-sm">
          <div className="font-medium text-haidee-text">{activeMode.label}</div>
          <div className="text-haidee-muted">
            {data.periodLabel || `${displayParams.year}年${displayParams.month}月`} · 币种{" "}
            {data.currency}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      <ReportFiltersChangedHint show={filtersDirty} />

      {!hasQueried && !loading && (
        <ReportAwaitingQuery>
          请选择年份、月份与付款模式，点击「查询」加载顾客账单列表。
          <br />
          Select year, month, and payment mode, then click Search.
        </ReportAwaitingQuery>
      )}

      {hasQueried && data && data.unpricedCount > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">
            ⚠️ 本月有 {data.unpricedCount}{" "}
            行已录入但未定价，不会计入账单，请先补费率/主数据
          </p>
          <p className="mt-1 text-xs text-amber-900">
            These tagged inbound lines have no freight amount and are excluded from
            monthly invoices (freightAmount &gt; 0 filter).
          </p>
          <details className="mt-3 border-t border-amber-200 pt-3">
            <summary className="cursor-pointer text-xs font-medium text-amber-900 hover:text-amber-950">
              查看明细 View details ({data.unpricedCount})
            </summary>
            <ScrollMatrixTable heightOffset={520} className="mt-3">
              <Table>
                <TableHeader>
                  <TableRow className="bg-amber-100/60 hover:bg-amber-100/60">
                    <TableHead>业务日 Date</TableHead>
                    <TableHead>趟次 Session</TableHead>
                    <TableHead>寄货人/收货人 Party</TableHead>
                    <TableHead>市场 Mkt</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>原因 Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.unpriced.map((line) => (
                    <TableRow key={line.lineId}>
                      <TableCell className="font-mono text-xs">
                        {line.businessDate}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {line.sessionCode}
                      </TableCell>
                      <TableCell className="text-xs">{line.partyLabel}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {line.marketCode || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {MODE_DISPLAY[line.mode] ?? line.mode}
                      </TableCell>
                      <TableCell className="text-xs">
                        {line.gapReasonLabel}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollMatrixTable>
          </details>
        </div>
      )}

      {hasQueried && data && (
        <>
          {data.customers.length === 0 ? (
            <p className="py-8 text-center text-sm text-haidee-muted">
              该月份暂无符合条件的账单数据 No invoice data for this period
            </p>
          ) : (
            <ScrollMatrixTable heightOffset={420}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                    <TableHead>顾客 Customer</TableHead>
                    <TableHead>代码 Code</TableHead>
                    <TableHead className="text-right">桶数 Tong</TableHead>
                    <TableHead className="text-right">箱数 Box</TableHead>
                    <TableHead className="text-right">桶金额 Tong Amt</TableHead>
                    <TableHead className="text-right">箱金额 Box Amt</TableHead>
                    <TableHead className="text-right">总计 Total</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.customers.map((customer) => (
                    <TableRow key={customer.customerId}>
                      <TableCell className="font-medium">
                        {customer.customerName}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {customer.customerCode}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {customer.tongQty || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {customer.boxQty || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {customer.tongAmount > 0
                          ? formatAmount(customer.tongAmount, data.currency)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {customer.boxAmount > 0
                          ? formatAmount(customer.boxAmount, data.currency)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatAmount(customer.grandTotal, data.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-[44px] gap-2"
                            onClick={() =>
                              setExtraChargesTarget({
                                customerId: customer.customerId,
                                customerName: customer.customerName,
                                customerCode: customer.customerCode,
                              })
                            }
                          >
                            <PlusCircle className="h-4 w-4" />
                            额外收费
                          </Button>
                          <Button
                            type="button"
                            className={DOCUMENT_ACTION_BTN}
                            onClick={() => openInvoice(customer.customerId)}
                          >
                            <FileText className="h-4 w-4" />
                            生成 PDF
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollMatrixTable>
          )}
        </>
      )}

      {extraChargesTarget && applied && data && (
        <MonthlyInvoiceExtraChargesDialog
          open={Boolean(extraChargesTarget)}
          onOpenChange={(open) => {
            if (!open) setExtraChargesTarget(null);
          }}
          year={applied.year}
          month={applied.month}
          mode={applied.mode}
          customerId={extraChargesTarget.customerId}
          customerName={extraChargesTarget.customerName}
          customerCode={extraChargesTarget.customerCode}
          currency={data.currency}
        />
      )}
    </div>
  );
}
