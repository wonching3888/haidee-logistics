"use client";

import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInputField } from "@/components/shared/DateInputField";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMyr } from "@/lib/driver-expense/voucher-utils";
import { formatDisplay } from "@/lib/date-utils";
import type { DriverVoucherListItem } from "@/lib/driver-expense/voucher-list-types";
import { cn } from "@/lib/utils";
import { VoucherStatusBadge } from "./VoucherStatusBadge";

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "draft", label: "估算" },
  { value: "clerk_entered", label: "已录待确认" },
  { value: "confirmed", label: "已确认" },
  { value: "pending_review", label: "待审核" },
  { value: "approved", label: "已审" },
  { value: "rejected", label: "已打回" },
] as const;

export interface HistoryFilters {
  from: string;
  to: string;
  status: string;
  q: string;
  pendingOnly: boolean;
}

interface VoucherHistoryPanelProps {
  filters: HistoryFilters;
  onFiltersChange: (next: HistoryFilters) => void;
  vouchers: DriverVoucherListItem[];
  loading: boolean;
  hasLoaded: boolean;
  isAdmin: boolean;
  pendingCount: number | null;
  onSearch: () => void;
  onPendingShortcut: () => void;
}

function buildViewHref(v: DriverVoucherListItem, filters: HistoryFilters) {
  const params = new URLSearchParams({
    date: v.tripDate,
    tab: "history",
    from: filters.from,
    to: filters.to,
  });
  if (filters.status) params.set("status", filters.status);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.pendingOnly) params.set("pending", "1");
  return `/documents/driver-expenses/${v.id}?${params.toString()}`;
}

export function VoucherHistoryPanel({
  filters,
  onFiltersChange,
  vouchers,
  loading,
  hasLoaded,
  isAdmin,
  pendingCount,
  onSearch,
  onPendingShortcut,
}: VoucherHistoryPanelProps) {
  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="no-print flex flex-wrap gap-2">
          <Button
            type="button"
            variant={filters.pendingOnly ? "default" : "outline"}
            size="sm"
            className={cn(
              filters.pendingOnly && "bg-orange-600 hover:bg-orange-600/90"
            )}
            onClick={onPendingShortcut}
          >
            待审核 ({pendingCount ?? "—"})
          </Button>
        </div>
      )}

      <div className="no-print flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">从 From</label>
          <DateInputField
            value={filters.from}
            onChange={(from) => onFiltersChange({ ...filters, from, pendingOnly: false })}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">至 To</label>
          <DateInputField
            value={filters.to}
            onChange={(to) => onFiltersChange({ ...filters, to, pendingOnly: false })}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">状态</label>
          <select
            value={filters.status}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                status: e.target.value,
                pendingOnly: false,
              })
            }
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[12rem] flex-1 items-center gap-2">
          <label className="text-sm font-medium shrink-0">搜索</label>
          <Input
            placeholder="单号 / 车牌"
            value={filters.q}
            onChange={(e) =>
              onFiltersChange({ ...filters, q: e.target.value, pendingOnly: false })
            }
            className="h-9"
          />
        </div>
        <Button
          type="button"
          onClick={onSearch}
          disabled={loading}
          className="gap-2 bg-haidee-blue text-white hover:bg-haidee-blue/90"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          查询 Search
        </Button>
      </div>

      {filters.pendingOnly && (
        <p className="text-xs text-haidee-muted">
          当前：全部待审核（不限日期）
        </p>
      )}

      {!hasLoaded && loading ? (
        <p className="flex items-center gap-2 text-sm text-haidee-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中…
        </p>
      ) : !hasLoaded ? (
        <p className="text-sm text-haidee-muted">请点击「查询」加载历史列表</p>
      ) : vouchers.length === 0 ? (
        <p className="text-sm text-haidee-muted">暂无符合条件的报销单</p>
      ) : (
        <ScrollMatrixTable heightOffset={360}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>单号</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>车牌</TableHead>
                <TableHead>司机</TableHead>
                <TableHead>路线</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">支出</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {vouchers.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-sm">{v.voucherNo}</TableCell>
                  <TableCell>{formatDisplay(v.tripDate)}</TableCell>
                  <TableCell>{v.lorry}</TableCell>
                  <TableCell>{v.driverName}</TableCell>
                  <TableCell>{v.route}</TableCell>
                  <TableCell>
                    <VoucherStatusBadge status={v.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {v.belanja != null ? formatMyr(v.belanja) : "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={buildViewHref(v, filters)}
                      className="inline-flex h-8 items-center rounded-lg border border-input px-2.5 text-sm hover:bg-accent"
                    >
                      查看
                    </Link>
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
