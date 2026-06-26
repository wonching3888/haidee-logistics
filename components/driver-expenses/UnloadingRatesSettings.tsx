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
import { useT } from "@/components/shared/locale-context";
import type { MessageKey } from "@/lib/i18n/messages";
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

const BM_PINDAH_MARKETS = new Set(["TP", "KT", "P", "SA", "NT"]);

const FIELD_HEADER_KEYS: Record<RateField, MessageKey> = {
  smallCrate: "driverExpenses.unloading.colSmall",
  largeCrate: "driverExpenses.unloading.colLarge",
  box: "driverExpenses.unloading.colBox",
  kpbSmall: "driverExpenses.unloading.colKpbSmall",
  kpbLarge: "driverExpenses.unloading.colKpbLarge",
  kpbBox: "driverExpenses.unloading.colKpbBox",
};

const A_PARKING_FIELD_KEYS: Partial<Record<RateField, MessageKey>> = {
  kpbSmall: "driverExpenses.unloading.kpbParkingFieldSmall",
  kpbLarge: "driverExpenses.unloading.kpbParkingFieldLarge",
  kpbBox: "driverExpenses.unloading.kpbParkingFieldBox",
};

function formatRate(value: number) {
  return String(value);
}

function isKpbField(field: RateField) {
  return field === "kpbSmall" || field === "kpbLarge" || field === "kpbBox";
}

/** Display-only: which cells are read-only (does not affect save payload). */
function isFieldReadOnly(market: string, field: RateField) {
  if (market === "JB") return true;
  if (market === "BM" || market === "KD") {
    if (isKpbField(field)) return true;
    if (market === "BM" && field === "largeCrate") return true;
    if (market === "KD" && (field === "largeCrate" || field === "box")) return true;
  }
  return false;
}

function fieldNoteKey(
  market: string,
  field: RateField
): MessageKey | null {
  if (market === "JB") return "driverExpenses.unloading.jbExempt";
  if ((market === "BM" || market === "KD") && isKpbField(field)) {
    return "driverExpenses.unloading.kpbPermanentlyCancelled";
  }
  if (market === "BM" && field === "largeCrate") {
    return "driverExpenses.unloading.unloadUnusedFieldNote";
  }
  if (market === "KD" && (field === "largeCrate" || field === "box")) {
    return "driverExpenses.unloading.unloadUnusedFieldNote";
  }
  return null;
}

function cellFieldLabel(
  market: string,
  field: RateField,
  t: (key: MessageKey) => string
) {
  if (market === "A" && isKpbField(field)) {
    const key = A_PARKING_FIELD_KEYS[field];
    if (key) return t(key);
  }
  return null;
}

export function UnloadingRatesSettings() {
  const { t } = useT();
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
        {t("driverExpenses.unloading.klSubMarketNote")}
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
              <TableHead>{t("driverExpenses.unloading.marketCol")}</TableHead>
              {NUMERIC_FIELDS.map((field) => (
                <TableHead key={field} className="text-right">
                  {t(FIELD_HEADER_KEYS[field])}
                </TableHead>
              ))}
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((row) => {
              const rowReadOnly = row.market === "JB";
              return (
                <TableRow key={row.market}>
                  <TableCell className="align-top font-medium">
                    {row.market}
                    <span className="ml-1 text-xs text-haidee-muted">
                      {getMarketDisplayName(row.market)}
                    </span>
                    {row.market === "A" && (
                      <span className="mt-0.5 block text-xs font-normal text-haidee-muted">
                        {t("driverExpenses.unloading.kpbParkingIpohNote")}
                      </span>
                    )}
                    {row.market === "KL" && (
                      <span className="mt-0.5 block text-xs font-normal text-haidee-muted">
                        {t("driverExpenses.unloading.klSubMarketNote")}
                      </span>
                    )}
                    {BM_PINDAH_MARKETS.has(row.market) && (
                      <span className="mt-0.5 block text-xs font-normal text-amber-700/90">
                        {t("driverExpenses.unloading.bmPindahDisplayPendingNote")}
                      </span>
                    )}
                  </TableCell>
                  {NUMERIC_FIELDS.map((field) => {
                    const readOnly = isFieldReadOnly(row.market, field);
                    const noteKey = fieldNoteKey(row.market, field);
                    const fieldLabel = cellFieldLabel(row.market, field, t);
                    return (
                      <TableCell key={field} className="align-top text-right">
                        <div className="ml-auto flex max-w-[7.5rem] flex-col items-end gap-0.5">
                          {fieldLabel && (
                            <span className="text-[10px] font-medium leading-tight text-haidee-muted">
                              {fieldLabel}
                            </span>
                          )}
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            readOnly={readOnly}
                            disabled={readOnly}
                            aria-readonly={readOnly}
                            className={cn(
                              "h-8 w-20 text-right font-mono text-sm",
                              readOnly &&
                                "cursor-not-allowed border-haidee-border/60 bg-haidee-surface/80 text-haidee-muted opacity-70"
                            )}
                            value={form[`${row.market}.${field}`] ?? ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                [`${row.market}.${field}`]: e.target.value,
                              }))
                            }
                          />
                          {noteKey && (
                            <span className="max-w-[7.5rem] text-left text-[10px] leading-tight text-haidee-muted">
                              {t(noteKey)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="align-top">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        rowReadOnly || (isPending && savingMarket === row.market)
                      }
                      onClick={() => saveRow(row.market)}
                      className={cn("h-8")}
                    >
                      {isPending && savingMarket === row.market ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        t("driverExpenses.unloading.save")
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollMatrixTable>
    </div>
  );
}
