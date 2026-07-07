"use client";

import { useMemo, useState } from "react";
import type {
  CrateStockAnomaly,
  CrateStockAnomalyRuleId,
} from "@/lib/crate-stock-anomalies";
import { CRATE_STOCK_ANOMALY_RULE_LABELS } from "@/lib/crate-stock-anomalies";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const RULE_ORDER: CrateStockAnomalyRuleId[] = [
  "duplicate_import_adjustment",
  "return_location_mismatch",
  "non_standard_location",
  "sadao_daily_spike",
];

interface CrateStockAnomaliesViewProps {
  scannedAt: string;
  anomalies: CrateStockAnomaly[];
  countsByRule: Record<string, number>;
}

function formatScannedAt(iso: string) {
  try {
    return new Date(iso).toLocaleString("sv-SE", {
      timeZone: "Asia/Bangkok",
    });
  } catch {
    return iso;
  }
}

export function CrateStockAnomaliesView({
  scannedAt,
  anomalies,
  countsByRule,
}: CrateStockAnomaliesViewProps) {
  const [activeRule, setActiveRule] = useState<CrateStockAnomalyRuleId | "all">(
    "all"
  );

  const filtered = useMemo(() => {
    if (activeRule === "all") return anomalies;
    return anomalies.filter((a) => a.rule === activeRule);
  }, [activeRule, anomalies]);

  const total = anomalies.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-haidee-muted">
        <span>扫描时间 {formatScannedAt(scannedAt)} (+0800)</span>
        <span>·</span>
        <span>
          共 <span className="font-mono text-haidee-text">{total}</span> 条
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveRule("all")}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm transition-colors",
            activeRule === "all"
              ? "border-haidee-accent bg-haidee-accent/10 text-haidee-text"
              : "border-haidee-border text-haidee-muted hover:bg-haidee-surface"
          )}
        >
          全部 ({total})
        </button>
        {RULE_ORDER.map((rule) => {
          const count = countsByRule[rule] ?? 0;
          return (
            <button
              key={rule}
              type="button"
              onClick={() => setActiveRule(rule)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                activeRule === rule
                  ? "border-haidee-accent bg-haidee-accent/10 text-haidee-text"
                  : "border-haidee-border text-haidee-muted hover:bg-haidee-surface"
              )}
            >
              {CRATE_STOCK_ANOMALY_RULE_LABELS[rule]} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-haidee-border bg-haidee-surface/50 px-4 py-8 text-center text-sm text-haidee-muted">
          {activeRule === "all"
            ? "当前未发现异常"
            : `「${CRATE_STOCK_ANOMALY_RULE_LABELS[activeRule as CrateStockAnomalyRuleId]}」暂无记录`}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-haidee-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">规则</TableHead>
                <TableHead className="w-[200px]">摘要</TableHead>
                <TableHead>说明</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="align-top text-sm">
                    <span
                      className={cn(
                        "inline-block rounded px-1.5 py-0.5 text-xs",
                        row.severity === "warning"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-slate-100 text-slate-700"
                      )}
                    >
                      {row.ruleLabel}
                    </span>
                  </TableCell>
                  <TableCell className="align-top text-sm font-medium">
                    {row.title}
                  </TableCell>
                  <TableCell className="align-top text-sm text-haidee-muted">
                    {row.detail}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
