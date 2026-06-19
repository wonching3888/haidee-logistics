"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { getCrateReturnMonthlyInvoices } from "@/app/actions/crate-return-invoice";
import type { CrateReturnMonthlyInvoiceSummary } from "@/lib/crate-return-billing";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function formatMyr(value: number) {
  return value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseYearMonth(searchParams: URLSearchParams) {
  const initial = currentYearMonth();
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  return {
    year: Number.isInteger(year) ? year : initial.year,
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : initial.month,
  };
}

export function CrateReturnMonthlyInvoicePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = parseYearMonth(searchParams);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [invoices, setInvoices] = useState<CrateReturnMonthlyInvoiceSummary[]>([]);
  const [totalAmountMyr, setTotalAmountMyr] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const currentYear = Number(searchParams.get("year"));
    const currentMonth = Number(searchParams.get("month"));
    if (currentYear === year && currentMonth === month) return;
    const params = new URLSearchParams();
    params.set("year", String(year));
    params.set("month", String(month));
    router.replace(`/documents/crate-return-invoice?${params.toString()}`, {
      scroll: false,
    });
  }, [year, month, router, searchParams]);

  useEffect(() => {
    startTransition(async () => {
      setError(null);
      try {
        const result = await getCrateReturnMonthlyInvoices({ year, month });
        setInvoices(result.invoices);
        setTotalAmountMyr(result.totalAmountMyr);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败 Load failed");
        setInvoices([]);
        setTotalAmountMyr(0);
      }
    });
  }, [year, month]);

  const years = Array.from({ length: 5 }, (_, i) => currentYearMonth().year - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1 text-sm">
          <span className="text-haidee-muted">年份 Year</span>
          <select
            className="block rounded-md border border-haidee-border px-3 py-2"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-haidee-muted">月份 Month</span>
          <select
            className="block rounded-md border border-haidee-border px-3 py-2"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm text-haidee-muted">
          合计 Total: <strong>{formatMyr(totalAmountMyr)} MYR</strong> ·{" "}
          {invoices.length} 张
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isPending ? (
        <div className="h-32 animate-pulse rounded-lg bg-haidee-border/30" />
      ) : invoices.length === 0 ? (
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
            {invoices.map((invoice) => (
              <TableRow key={invoice.invoiceId}>
                <TableCell className="font-mono">{invoice.crateType}</TableCell>
                <TableCell>
                  <div>{invoice.billToName}</div>
                  <div className="text-xs text-haidee-muted">{invoice.billToCode}</div>
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
                    className="inline-flex h-8 items-center justify-center rounded-md border border-haidee-border px-3 text-sm font-medium hover:bg-haidee-border/20"
                    href={`/documents/crate-return-invoice/print?year=${year}&month=${month}&crateType=${encodeURIComponent(invoice.crateType)}`}
                  >
                    打印 Print
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
