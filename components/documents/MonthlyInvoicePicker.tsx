"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

const DOCUMENT_ACTION_BTN =
  "min-h-[44px] gap-2 px-5 text-sm font-medium bg-haidee-blue text-white hover:bg-haidee-blue/90 disabled:bg-gray-300 disabled:text-gray-500 disabled:opacity-100 disabled:hover:bg-gray-300";

const YEAR_OPTIONS = Array.from({ length: 11 }, (_, index) => 2020 + index);

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
  const initial = parseYearMonthFromSearchParams(searchParams);
  const urlMode = searchParams.get("mode");
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [mode, setMode] = useState<MonthlyInvoiceMode>(
    urlMode && isMonthlyInvoiceMode(urlMode) ? urlMode : "1a"
  );
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [periodLabel, setPeriodLabel] = useState("");
  const [currency, setCurrency] = useState("THB");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!syncListUrl) return;
    const currentMode = searchParams.get("mode");
    const yearMonthOk =
      searchParams.get("year") === String(year) &&
      searchParams.get("month") === String(month);
    if (yearMonthOk && currentMode === mode) return;
    const params = new URLSearchParams();
    params.set("year", String(year));
    params.set("month", String(month));
    params.set("mode", mode);
    router.replace(`/documents/monthly-invoice?${params.toString()}`, {
      scroll: false,
    });
  }, [syncListUrl, year, month, mode, router, searchParams]);

  useEffect(() => {
    startTransition(async () => {
      setError(null);
      try {
        const result = await getMonthlyInvoiceCustomers({ year, month, mode });
        setCustomers(result.customers);
        setPeriodLabel(result.periodLabel);
        setCurrency(result.mode.currency);
      } catch (e) {
        setCustomers([]);
        setError(e instanceof Error ? e.message : "加载失败");
      }
    });
  }, [year, month, mode]);

  function openInvoice(customerId: string) {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
      mode,
      customerId,
    });
    if (listHref) {
      params.set("returnTo", listHref);
    }
    router.push(`/documents/monthly-invoice/print?${params.toString()}`);
  }

  const activeMode = MONTHLY_INVOICE_MODES.find((item) => item.value === mode)!;

  return (
    <div className="space-y-4">
      <p className="text-xs text-haidee-muted">
        选择年份与月份，按五种付款模式分别生成月结账单。每位顾客单独一份 PDF。
        Select year/month and mode; one printable invoice per customer.
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-haidee-text">年份 Year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="min-h-[44px] rounded-lg border border-haidee-border px-3 text-sm"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-haidee-text">月份 Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="min-h-[44px] rounded-lg border border-haidee-border px-3 text-sm"
          >
            {Array.from({ length: 12 }, (_, index) => index + 1).map((m) => (
              <option key={m} value={m}>
                {m} 月
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {MONTHLY_INVOICE_MODES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setMode(item.value)}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              mode === item.value
                ? "border-haidee-blue bg-haidee-blue/10 text-haidee-blue"
                : "border-haidee-border bg-white hover:bg-haidee-surface/60"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-haidee-border bg-haidee-surface/40 px-4 py-3 text-sm">
        <div className="font-medium text-haidee-text">{activeMode.label}</div>
        <div className="text-haidee-muted">
          {periodLabel || `${year}年${month}月`} · 币种 {currency}
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      {isPending ? (
        <div className="h-32 animate-pulse rounded-lg bg-haidee-border/30" />
      ) : customers.length === 0 ? (
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
              {customers.map((customer) => (
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
                      ? formatAmount(customer.tongAmount, currency)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {customer.boxAmount > 0
                      ? formatAmount(customer.boxAmount, currency)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatAmount(customer.grandTotal, currency)}
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
    </div>
  );
}
