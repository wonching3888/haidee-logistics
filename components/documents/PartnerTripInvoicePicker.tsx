"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { getPartnerTripInvoiceTrips } from "@/app/actions/partner-trip-invoice";
import type { PartnerTripSummary } from "@/lib/partner-freight";
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

export function PartnerTripInvoicePicker() {
  const initial = currentYearMonth();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [trips, setTrips] = useState<PartnerTripSummary[]>([]);
  const [totalAmountMyr, setTotalAmountMyr] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setError(null);
      try {
        const result = await getPartnerTripInvoiceTrips({ year, month });
        setTrips(result.trips);
        setTotalAmountMyr(result.totalAmountMyr);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败 Load failed");
        setTrips([]);
        setTotalAmountMyr(0);
      }
    });
  }, [year, month]);

  const years = Array.from({ length: 5 }, (_, i) => initial.year - 2 + i);
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
          {trips.length} 趟
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isPending ? (
        <div className="h-32 animate-pulse rounded-lg bg-haidee-border/30" />
      ) : trips.length === 0 ? (
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
            {trips.map((trip) => (
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
                    href={`/documents/partner-trip-invoice/print?tripDate=${encodeURIComponent(trip.tripDateInput)}&truckId=${trip.truckId}&marketId=${trip.marketId}&crateType=${trip.crateType}`}
                    target="_blank"
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
