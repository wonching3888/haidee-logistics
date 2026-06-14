"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  getOperationsDashboard,
  saveOperationsMonthlyCosts,
} from "@/app/actions/operations-dashboard";
import type { OperationsDashboardData } from "@/lib/operations-dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => 2020 + i);

function formatMyr(value: number) {
  return `${value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MYR`;
}

function SourceBadge({ source }: { source: "actual" | "estimate" }) {
  if (source === "actual") {
    return (
      <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
        实际
      </span>
    );
  }
  return (
    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
      估算
    </span>
  );
}

interface OperationsDashboardViewProps {
  initialYear: number;
  initialMonth: number;
  initialData: OperationsDashboardData;
}

export function OperationsDashboardView({
  initialYear,
  initialMonth,
  initialData,
}: OperationsDashboardViewProps) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<OperationsDashboardData>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lkimMaqisFee, setLkimMaqisFee] = useState(() =>
    initialData.manualCosts.lkimMaqisFee != null
      ? String(initialData.manualCosts.lkimMaqisFee)
      : ""
  );
  const skipInitialFetch = useRef(true);

  function loadDashboard() {
    startTransition(async () => {
      setError(null);
      try {
        const result = await getOperationsDashboard({ year, month });
        setData(result);
        setLkimMaqisFee(
          result.manualCosts.lkimMaqisFee != null
            ? String(result.manualCosts.lkimMaqisFee)
            : ""
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      }
    });
  }

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  function parseOptionalCost(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error("费用不能为负数");
    }
    return parsed;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">年份 Year</label>
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
          <label className="text-sm font-medium">月份 Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="min-h-[44px] rounded-lg border border-haidee-border px-3 text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m} 月
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-haidee-muted">
          当月汇率：THB ÷ {data.exchangeRate.toFixed(4)} = MYR
          {data.exchangeRateMissing && (
            <span className="ml-2 text-amber-700">（未设定，使用默认）</span>
          )}
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      {isPending && (
        <div className="h-2 animate-pulse rounded bg-haidee-border/40" />
      )}

      <section className="rounded-xl border border-haidee-border bg-white p-5">
        <h3 className="mb-4 text-lg font-semibold text-haidee-text">
          收入 Revenue
        </h3>
        <dl className="space-y-3">
          {data.revenue.lines.map((line) => (
            <div
              key={line.key}
              className={`flex flex-wrap items-baseline justify-between gap-2 border-b border-haidee-border/60 pb-2 ${
                line.key === "haidee" ? "font-semibold" : ""
              }`}
            >
              <dt className="text-sm">
                {line.label}
                <span className="ml-1 text-xs text-haidee-muted">
                  {line.labelEn}
                </span>
                <SourceBadge source={line.source} />
                {line.detail && (
                  <span className="mt-0.5 block text-xs text-haidee-muted">
                    {line.detail}
                  </span>
                )}
              </dt>
              <dd className="font-mono text-base">
                {formatMyr(line.amountMyr)}
              </dd>
            </div>
          ))}
          <div className="flex justify-between border-t-2 border-haidee-navy pt-3 text-lg font-bold">
            <dt>总收入 Total Revenue</dt>
            <dd className="font-mono text-haidee-navy">
              {formatMyr(data.revenue.totalMyr)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-haidee-border bg-white p-5">
        <h3 className="mb-2 text-lg font-semibold text-haidee-text">
          成本 Costs
        </h3>
        <p className="mb-4 text-xs text-haidee-muted">
          过路费/租桶/Load-Unload 由派车路线 × 市场运营费率自动计算。固定
          Expenses（Office 工资等）由老板自行扣除，系统不计算。
        </p>

        <div className="mb-4 grid gap-3 rounded-lg border border-dashed border-haidee-border bg-haidee-surface/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1 text-sm sm:col-span-2 lg:col-span-3">
            LKIM-MAQIS费（估算，可编辑）
            <Input
              value={lkimMaqisFee}
              onChange={(e) => setLkimMaqisFee(e.target.value)}
              className="min-h-[44px] font-mono"
            />
          </label>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  try {
                    await saveOperationsMonthlyCosts({
                      year,
                      month,
                      lkimMaqisFee: parseOptionalCost(lkimMaqisFee),
                    });
                    loadDashboard();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "保存失败");
                  }
                })
              }
            >
              保存 LKIM-MAQIS
            </Button>
          </div>
        </div>

        <dl className="space-y-3">
          {data.costs.lines.map((line) => (
            <div
              key={line.key}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-haidee-border/60 pb-2"
            >
              <dt className="text-sm">
                {line.label}
                <span className="ml-1 text-xs text-haidee-muted">
                  {line.labelEn}
                </span>
                <SourceBadge source={line.source} />
                {line.detail && (
                  <span className="mt-0.5 block text-xs text-haidee-muted">
                    {line.detail}
                  </span>
                )}
              </dt>
              <dd className="font-mono text-base">
                {formatMyr(line.amountMyr)}
              </dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-haidee-border pt-3 font-semibold">
            <dt>小计成本 Subtotal Costs</dt>
            <dd className="font-mono">{formatMyr(data.costs.subtotalMyr)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border-2 border-haidee-navy bg-haidee-navy/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-haidee-navy">
            运营毛利 Operating Gross Profit
          </h3>
          <p className="font-mono text-2xl font-bold text-haidee-navy">
            {formatMyr(data.grossProfitMyr)}
          </p>
        </div>
        <p className="mt-2 text-sm text-haidee-muted">
          总收入 − 小计成本（不含 Office 等固定开销）
        </p>
      </section>
    </div>
  );
}
