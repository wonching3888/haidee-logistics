"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { getMonthlyInvoiceCustomers } from "@/app/actions/monthly-invoice";
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
}

function formatAmount(value: number, currency: string) {
  return `${value.toFixed(2)} ${currency}`;
}

interface MonthlyInvoicePickerProps {
  /** List page to return to from print view (e.g. embedded in /documents). */
  listHref?: string;
}

export function MonthlyInvoicePicker({ listHref }: MonthlyInvoicePickerProps = {}) {
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
    const result = await getMonthlyInvoiceCustomers({
      year: draft.year,
      month: draft.month,
      mode: draft.mode,
    });
    return {
      customers: result.customers,
      periodLabel: result.periodLabel,
      currency: result.mode.currency,
    };
  }, []);

  const buildUrlParams = useCallback((draft: MonthlyInvoiceDraft) => {
    const params = new URLSearchParams();
    params.set("year", String(draft.year));
    params.set("month", String(draft.month));
    params.set("mode", draft.mode);
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

  return (
    <div className="space-y-4">
      <p className="text-xs text-haidee-muted">
        选择年份与月份，按五种付款模式分别生成月结账单。每位顾客单独一份 PDF。
        Select year/month and mode; one printable invoice per customer.
      </p>

      <ReportFilterBar loading={loading} onSearch={() => void search()}>
        <YearMonthFields
          year={draft.year}
          month={draft.month}
          onYearChange={(year) => setDraft((prev) => ({ ...prev, year }))}
          onMonthChange={(month) => setDraft((prev) => ({ ...prev, month }))}
        />
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
                        <Button
                          type="button"
                          className={DOCUMENT_ACTION_BTN}
                          onClick={() => openInvoice(customer.customerId)}
                        >
                          <FileText className="h-4 w-4" />
                          生成 PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollMatrixTable>
          )}
        </>
      )}
    </div>
  );
}
