"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { Printer, Search } from "lucide-react";
import { searchStallByCode } from "@/app/actions/summary";
import type { DailySummaryData } from "@/app/actions/summary";
import { MarketBadge } from "@/components/shared/MarketBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMarketColor } from "@/lib/markets";
import { toDateInputValue } from "@/lib/date-utils";

interface SummaryViewProps {
  date: string;
  displayDate: string;
  data: DailySummaryData;
}

export function SummaryView({ date, displayDate, data }: SummaryViewProps) {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<
    Awaited<ReturnType<typeof searchStallByCode>>
  >([]);
  const [isPending, startTransition] = useTransition();

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `daily-summary-${date}`,
  });

  function runSearch(value: string) {
    setSearch(value);
    setSearchError(null);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    startTransition(async () => {
      try {
        const results = await searchStallByCode(date, value);
        setSearchResults(results);
      } catch (e) {
        setSearchResults([]);
        setSearchError(
          e instanceof Error ? e.message : "搜索失败 Search failed"
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">
            日期 Date <span className="font-mono text-haidee-muted">({displayDate})</span>
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              const params = new URLSearchParams();
              params.set("date", e.target.value || toDateInputValue(new Date()));
              router.push(`/summary?${params.toString()}`);
            }}
            className="min-h-[44px] w-auto"
          />
        </div>
        <div className="min-w-[240px] flex-1 space-y-1">
          <label className="text-sm font-medium">
            搜索档口 Search Stall
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-haidee-muted" />
            <Input
              value={search}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="A50"
              className="min-h-[44px] pl-10"
            />
          </div>
        </div>
        <Button onClick={handlePrint} className="gap-2 bg-haidee-blue text-white">
          <Printer className="h-4 w-4" />
          打印 Print
        </Button>
      </div>

      {searchError && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {searchError}
        </p>
      )}

      {search && (
        <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
          <div className="border-b px-4 py-2 text-sm font-medium">
            找到 &quot;{search}&quot; 的记录 Results
          </div>
          {isPending ? (
            <p className="p-4 text-haidee-muted">搜索中…</p>
          ) : searchResults.length === 0 ? (
            <p className="p-4 text-haidee-muted">无结果 No results</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-haidee-surface text-haidee-muted">
                  <th className="px-4 py-2 text-left">档口</th>
                  <th className="px-4 py-2 text-left">地区</th>
                  <th className="px-4 py-2 text-left">寄货人</th>
                  <th className="px-4 py-2 text-left">车辆</th>
                  <th className="px-4 py-2 text-right">桶数</th>
                  <th className="px-4 py-2 text-left">状态</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((r, i) => (
                  <tr key={i} className="border-t border-haidee-border/60">
                    <td className="px-4 py-2 font-mono">{r.stallCode}</td>
                    <td className="px-4 py-2 font-mono">{r.marketCode}</td>
                    <td className="px-4 py-2">{r.shipperName}</td>
                    <td className="px-4 py-2 font-mono">{r.vehicle}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.quantity}</td>
                    <td className="px-4 py-2">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div ref={printRef} className="summary-print overflow-hidden rounded-xl border border-haidee-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-xs">
            <thead>
              <tr>
                <th className="border border-haidee-border bg-haidee-surface px-2 py-2 text-left">
                  寄货人 / 地区
                </th>
                {data.columns.map((col) => {
                  const c = getMarketColor(col.marketCode);
                  return (
                    <th
                      key={col.id}
                      className="border border-haidee-border px-1 py-2 text-center"
                      style={{ backgroundColor: c.light }}
                    >
                      <div className="font-mono font-bold">{col.truckPlate}</div>
                      <MarketBadge code={col.marketCode} />
                      {col.capacity && (
                        <div className="text-[10px] text-haidee-muted">
                          ({col.capacity})
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className="border border-haidee-border bg-haidee-surface px-2 py-2">
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={data.columns.length + 2}
                    className="border border-haidee-border px-4 py-8 text-center text-haidee-muted"
                  >
                    当日暂无已分配货物 No assigned cargo for this date
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr key={row.sessionId}>
                    <td className="border border-haidee-border px-2 py-1 font-medium">
                      {row.label}
                    </td>
                    {data.columns.map((col) => {
                      const qty = row.cells[col.id] ?? 0;
                      return (
                        <td
                          key={col.id}
                          className="border border-haidee-border px-1 py-1 text-center font-mono"
                        >
                          {qty > 0 ? qty : ""}
                        </td>
                      );
                    })}
                    <td className="border border-haidee-border px-2 py-1 text-right font-mono font-semibold">
                      {row.total}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data.rows.length > 0 && (
              <tfoot>
                <tr className="bg-haidee-navy/5 font-bold">
                  <td className="border border-haidee-border px-2 py-2">
                    各市场总计
                  </td>
                  {data.columns.map((col) => (
                    <td
                      key={col.id}
                      className="border border-haidee-border px-1 py-2 text-center font-mono"
                    >
                      {data.columnTotals[col.id] ?? ""}
                    </td>
                  ))}
                  <td className="border border-haidee-border px-2 py-2 text-right font-mono">
                    {data.grandTotal}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 8mm;
          }
          .summary-print {
            font-size: 9px !important;
          }
          .summary-print table {
            font-size: 8px !important;
          }
        }
      `}</style>
    </div>
  );
}
