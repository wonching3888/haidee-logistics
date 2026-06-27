"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import {
  voucherAuditFieldLabel,
  VOUCHER_AUDITED_FIELD_LABELS,
} from "@/lib/driver-voucher-audit";
import {
  VOUCHER_STATUS_LABELS,
  isVoucherStatus,
} from "@/lib/driver-voucher-status-types";
import { cn } from "@/lib/utils";

export interface VoucherChangeLogEntry {
  id: string;
  eventType: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string | null;
  changedByName: string | null;
  changedAt: string;
  reason: string | null;
}

interface VoucherChangeLogTimelineProps {
  logs: VoucherChangeLogEntry[];
  loading: boolean;
}

function formatDisplayValue(field: string | null, value: string | null) {
  if (value == null || value === "") return "—";
  if (field === "minyak_moto_enabled") {
    return value === "true" ? "是" : "否";
  }
  if (field === "status" && value && isVoucherStatus(value)) {
    return VOUCHER_STATUS_LABELS[value];
  }
  return value;
}

function formatFieldLabel(field: string | null) {
  if (!field) return "—";
  return voucherAuditFieldLabel(field);
}

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VoucherChangeLogTimeline({
  logs,
  loading,
}: VoucherChangeLogTimelineProps) {
  return (
    <section className="no-print space-y-3 rounded-xl border border-haidee-border bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-haidee-text">修改记录 / Change log</h3>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-haidee-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中…
        </p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-haidee-muted">暂无修改记录</p>
      ) : (
        <ol className="space-y-3">
          {logs.map((log) => {
            const isStatusChange =
              log.eventType === "status_change" || log.eventType === "reopen";
            const statusBadgeLabel =
              log.eventType === "reopen" ? "重新打开" : "状态变更";
            return (
              <li
                key={log.id}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  isStatusChange
                    ? "border-blue-200 bg-blue-50/50"
                    : "border-haidee-border bg-haidee-surface/20"
                )}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-haidee-muted">
                  <span className="font-mono text-xs">
                    {formatTimestamp(log.changedAt)}
                  </span>
                  <span>·</span>
                  <span>{log.changedByName ?? log.changedBy ?? "—"}</span>
                  {isStatusChange && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
                      {statusBadgeLabel}
                    </span>
                  )}
                </div>

                <div className="mt-1">
                  {isStatusChange ? (
                    <span>
                      <span className="font-medium">{formatFieldLabel(log.field)}</span>
                      {": "}
                      <span className="font-mono">
                        {formatDisplayValue("status", log.oldValue)}
                      </span>
                      <ArrowRight className="mx-1 inline h-3 w-3" />
                      <span className="font-mono font-semibold">
                        {formatDisplayValue("status", log.newValue)}
                      </span>
                    </span>
                  ) : (
                    <span>
                      <span className="font-medium">{formatFieldLabel(log.field)}</span>
                      {": "}
                      <span className="font-mono text-haidee-red line-through">
                        {formatDisplayValue(log.field, log.oldValue)}
                      </span>
                      <ArrowRight className="mx-1 inline h-3 w-3" />
                      <span className="font-mono font-semibold text-emerald-700">
                        {formatDisplayValue(log.field, log.newValue)}
                      </span>
                    </span>
                  )}
                </div>

                {log.reason && (
                  <p className="mt-1 text-haidee-muted">
                    原因：{log.reason}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// Re-export for tree-shaking clarity in consumers
export { VOUCHER_AUDITED_FIELD_LABELS };
