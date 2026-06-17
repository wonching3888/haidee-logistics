"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
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
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { getMarketDisplayName } from "@/lib/constants/market-names";
import { cn } from "@/lib/utils";

interface UnloadingRateRow {
  market: string;
  smallCrate: number;
  largeCrate: number;
  box: number;
  kpbSmall: number;
  kpbLarge: number;
  kpbBox: number;
  kpbMode: string;
  unloadMode: string;
}

type RateField = keyof Omit<UnloadingRateRow, "market" | "kpbMode" | "unloadMode">;

const NUMERIC_FIELDS: RateField[] = [
  "smallCrate",
  "largeCrate",
  "box",
  "kpbSmall",
  "kpbLarge",
  "kpbBox",
];

function formatRate(value: number) {
  return String(value);
}

export function UnloadingRatesSettings() {
  const [rates, setRates] = useState<UnloadingRateRow[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingMarket, setSavingMarket] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadRates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/unloading-rates");
      if (!res.ok) throw new Error("无法加载费率 Failed to load rates");
      const data = (await res.json()) as { rates?: UnloadingRateRow[] };
      const rows = data.rates ?? [];
      setRates(rows);
      setForm(
        Object.fromEntries(
          rows.flatMap((row) =>
            NUMERIC_FIELDS.map((field) => [
              `${row.market}.${field}`,
              formatRate(row[field]),
            ])
          )
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  function parseField(value: string, label: string) {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`${label} 不能为负数`);
    }
    return parsed;
  }

  function saveRow(market: string) {
    const row = rates.find((r) => r.market === market);
    if (!row) return;

    startTransition(async () => {
      setSavingMarket(market);
      setError(null);
      try {
        const payload: UnloadingRateRow = {
          market,
          smallCrate: parseField(form[`${market}.smallCrate`] ?? "", "小桶"),
          largeCrate: parseField(form[`${market}.largeCrate`] ?? "", "大桶"),
          box: parseField(form[`${market}.box`] ?? "", "箱"),
          kpbSmall: parseField(form[`${market}.kpbSmall`] ?? "", "KPB小"),
          kpbLarge: parseField(form[`${market}.kpbLarge`] ?? "", "KPB大"),
          kpbBox: parseField(form[`${market}.kpbBox`] ?? "", "KPB箱"),
          kpbMode: row.kpbMode,
          unloadMode: row.unloadMode,
        };
        const res = await fetch("/api/unloading-rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "保存失败");
        }
        await loadRates();
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失败");
      } finally {
        setSavingMarket(null);
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-haidee-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        加载中…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-haidee-muted">
        各市场下货费与 KPB 费率（MYR），驱动 P&amp;L 下货成本与司机费用模块计算。
        Unloading and KPB rates per market; used for P&amp;L unload costs and driver
        expense records.
      </p>
      <p className="rounded-lg border border-haidee-border bg-haidee-surface/50 px-4 py-3 text-sm text-haidee-text">
        <span className="font-medium">KL 搬车子市场（SL / BP / MP）：</span>
        基础下货费按 KL 费率、按桶/箱量计费；KPB 仅在档口编号符合 A–H
        加数字格式时收取，无档口则豁免 KPB。
        Sub-markets SL, BP, MP use KL unload rates; KPB applies only when stall code
        matches the KL store pattern.
      </p>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <ScrollMatrixTable heightOffset={220}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>市场 Market</TableHead>
              <TableHead className="text-right">小桶 Small</TableHead>
              <TableHead className="text-right">大桶 Large</TableHead>
              <TableHead className="text-right">箱 Box</TableHead>
              <TableHead className="text-right">KPB小</TableHead>
              <TableHead className="text-right">KPB大</TableHead>
              <TableHead className="text-right">KPB箱</TableHead>
              <TableHead>下货模式</TableHead>
              <TableHead>KPB模式</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((row) => (
              <TableRow key={row.market}>
                <TableCell className="font-medium">
                  {row.market}
                  <span className="ml-1 text-xs text-haidee-muted">
                    {getMarketDisplayName(row.market)}
                  </span>
                </TableCell>
                {NUMERIC_FIELDS.map((field) => (
                  <TableCell key={field} className="text-right">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="ml-auto h-8 w-20 text-right font-mono text-sm"
                      value={form[`${row.market}.${field}`] ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          [`${row.market}.${field}`]: e.target.value,
                        }))
                      }
                    />
                  </TableCell>
                ))}
                <TableCell className="text-xs text-haidee-muted">
                  {row.unloadMode}
                </TableCell>
                <TableCell className="text-xs text-haidee-muted">
                  {row.kpbMode}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending && savingMarket === row.market}
                    onClick={() => saveRow(row.market)}
                    className={cn("h-8")}
                  >
                    {isPending && savingMarket === row.market ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "保存"
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollMatrixTable>
    </div>
  );
}
