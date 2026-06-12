"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import type { SearchResult } from "@/app/actions/search";
import { DateInputField } from "@/components/shared/DateInputField";
import { normalizeDateRange } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SearchViewProps {
  fromDate: string;
  toDate: string;
  query: string;
  data: SearchResult;
}

export function SearchView({ fromDate, toDate, query, data }: SearchViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [localFrom, setLocalFrom] = useState(fromDate);
  const [localTo, setLocalTo] = useState(toDate);
  const [localQuery, setLocalQuery] = useState(query);

  useEffect(() => {
    setLocalFrom(fromDate);
    setLocalTo(toDate);
    setLocalQuery(query);
  }, [fromDate, toDate, query]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const { from, to } = normalizeDateRange(localFrom, localTo);
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", from);
    params.set("to", to);
    params.delete("date");
    if (localQuery.trim()) {
      params.set("q", localQuery.trim());
    } else {
      params.delete("q");
    }
    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSearch}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-haidee-border bg-white p-4"
      >
        <div className="space-y-1">
          <label className="text-xs font-medium text-haidee-muted">
            开始日期 Date From
          </label>
          <DateInputField value={localFrom} onChange={setLocalFrom} />
        </div>
        <span className="pb-2 text-sm text-haidee-muted">至 to</span>
        <div className="space-y-1">
          <label className="text-xs font-medium text-haidee-muted">
            结束日期 Date To
          </label>
          <DateInputField value={localTo} onChange={setLocalTo} />
        </div>
        <div className="min-w-[200px] flex-1 space-y-1">
          <label className="text-xs font-medium text-haidee-muted">
            关键字 Keyword
          </label>
          <Input
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="寄货人 / 档口 / 车牌 / 桶型 / 备注…"
            className="min-h-[44px]"
          />
        </div>
        <Button
          type="submit"
          disabled={isPending}
          className="min-h-[44px] gap-2 bg-haidee-blue text-white hover:bg-haidee-blue/90"
        >
          <Search className="h-4 w-4" />
          {isPending ? "查询中…" : "查询 Search"}
        </Button>
      </form>

      {data.truckHeader && (
        <div className="rounded-xl border border-haidee-blue/30 bg-haidee-blue/5 px-4 py-3 text-sm">
          <span className="font-medium text-haidee-text">
            车牌 Plate:{" "}
            <span className="font-mono">{data.truckHeader.plate}</span>
          </span>
          <span className="mx-3 text-haidee-muted">|</span>
          <span className="font-medium text-haidee-text">
            司机 Driver: {data.truckHeader.driverName}
          </span>
          <span className="mx-3 text-haidee-muted">|</span>
          <span className="font-medium text-haidee-text">
            总计 Total:{" "}
            <span className="font-mono">{data.truckHeader.totalCrates}</span> 桶
          </span>
        </div>
      )}

      <SearchResults rows={data.rows} hasQuery={!!query.trim()} />
    </div>
  );
}

function SearchResults({
  rows,
  hasQuery,
}: {
  rows: SearchResult["rows"];
  hasQuery: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-haidee-border bg-white p-12 text-center text-haidee-muted">
        {hasQuery
          ? "无匹配结果 No matching records"
          : "请输入关键字开始查询 Enter a keyword to search"}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
            <TableHead>寄货人 Consignor</TableHead>
            <TableHead>收货人 Store</TableHead>
            <TableHead>桶型 Crate Type</TableHead>
            <TableHead className="text-right">数量 Qty</TableHead>
            <TableHead>市场 Market</TableHead>
            <TableHead>车牌 Plate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={`${row.shipperName}-${row.stallCode}-${row.tongTypeCode}-${row.truckPlate}-${i}`}
            >
              <TableCell>
                <div className="font-medium text-haidee-text">{row.shipperName}</div>
                {row.areaNote?.trim() && (
                  <div className="text-xs text-haidee-muted">
                    ({row.areaNote.trim()})
                  </div>
                )}
              </TableCell>
              <TableCell className="font-mono">{row.stallCode}</TableCell>
              <TableCell className="font-mono">{row.tongTypeCode}</TableCell>
              <TableCell className="text-right font-mono">
                {row.quantity}
                {row.isBox ? " 盒" : " 桶"}
              </TableCell>
              <TableCell className="font-mono">{row.marketCode}</TableCell>
              <TableCell
                className={
                  row.truckPlate === "未派车"
                    ? "text-haidee-muted"
                    : "font-mono"
                }
              >
                {row.truckPlate}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="border-t border-haidee-border px-4 py-2 text-xs text-haidee-muted">
        共 {rows.length} 条记录 {rows.length} record(s)
      </p>
    </div>
  );
}
