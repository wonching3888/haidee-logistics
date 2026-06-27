"use client";

import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInputField } from "@/components/shared/DateInputField";
import { WideTableScrollArea } from "@/components/shared/WideTableScrollArea";
import { useT } from "@/components/shared/locale-context";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMyr } from "@/lib/driver-expense/voucher-utils";
import { formatDisplay } from "@/lib/date-utils";
import type { DriverVoucherListItem } from "@/lib/driver-expense/voucher-list-types";
import type { MessageKey } from "@/lib/i18n/messages";
import { VoucherStatusBadge } from "./VoucherStatusBadge";

const STATUS_OPTION_KEYS: { value: string; labelKey: MessageKey }[] = [
  { value: "", labelKey: "driverExpenses.status.all" },
  { value: "draft", labelKey: "driverExpenses.status.draft" },
  { value: "clerk_entered", labelKey: "driverExpenses.status.clerk_entered" },
  { value: "confirmed", labelKey: "driverExpenses.status.confirmed" },
  { value: "pending_review", labelKey: "driverExpenses.status.pending_review" },
  { value: "approved", labelKey: "driverExpenses.status.approved" },
  { value: "rejected", labelKey: "driverExpenses.status.rejected" },
];

export interface HistoryFilters {
  from: string;
  to: string;
  status: string;
  q: string;
}

interface VoucherHistoryPanelProps {
  filters: HistoryFilters;
  onFiltersChange: (next: HistoryFilters) => void;
  vouchers: DriverVoucherListItem[];
  loading: boolean;
  hasLoaded: boolean;
  isAdmin: boolean;
  onSearch: () => void;
}

function buildViewHref(v: DriverVoucherListItem, filters: HistoryFilters) {
  const params = new URLSearchParams({
    date: v.tripDate,
    from: filters.from,
    to: filters.to,
  });
  if (filters.status) params.set("status", filters.status);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  return `/documents/driver-expenses/${v.id}?${params.toString()}`;
}

export function VoucherHistoryPanel({
  filters,
  onFiltersChange,
  vouchers,
  loading,
  hasLoaded,
  isAdmin,
  onSearch,
}: VoucherHistoryPanelProps) {
  const { t } = useT();

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">{t("driverExpenses.from")}</label>
          <DateInputField
            value={filters.from}
            onChange={(from) => onFiltersChange({ ...filters, from })}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">{t("driverExpenses.to")}</label>
          <DateInputField
            value={filters.to}
            onChange={(to) => onFiltersChange({ ...filters, to })}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">{t("common.status")}</label>
          <select
            value={filters.status}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                status: e.target.value,
              })
            }
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {STATUS_OPTION_KEYS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[12rem] flex-1 items-center gap-2">
          <label className="text-sm font-medium shrink-0">{t("common.search")}</label>
          <Input
            placeholder={t("driverExpenses.searchPlaceholder")}
            value={filters.q}
            onChange={(e) =>
              onFiltersChange({ ...filters, q: e.target.value })
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
          {t("driverExpenses.search")}
        </Button>
      </div>

      {!hasLoaded && loading ? (
        <p className="flex items-center gap-2 text-sm text-haidee-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("driverExpenses.loading")}
        </p>
      ) : !hasLoaded ? (
        <p className="text-sm text-haidee-muted">
          {t("driverExpenses.empty.historyQuery")}
        </p>
      ) : vouchers.length === 0 ? (
        <p className="text-sm text-haidee-muted">
          {t("driverExpenses.empty.noHistory")}
        </p>
      ) : (
        <WideTableScrollArea heightOffset={420}>
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead>{t("driverExpenses.col.voucherNo")}</TableHead>
                <TableHead>{t("driverExpenses.col.date")}</TableHead>
                <TableHead>{t("driverExpenses.col.plate")}</TableHead>
                <TableHead>{t("driverExpenses.col.driver")}</TableHead>
                <TableHead>{t("driverExpenses.col.route")}</TableHead>
                <TableHead>类型 Type</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">
                  {t("driverExpenses.col.expense")}
                </TableHead>
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
                    {v.tripSource === "charter" ? (
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-800">
                        包车
                      </span>
                    ) : (
                      <span className="text-xs text-haidee-muted">派车</span>
                    )}
                  </TableCell>
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
                      {isAdmin && v.status === "pending_review"
                        ? t("driverExpenses.action.review")
                        : t("driverExpenses.action.view")}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
        </WideTableScrollArea>
      )}
    </div>
  );
}
