"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import {
  THAI_SEGMENT_RATE_KEYS,
  THAI_SEGMENT_RATE_UI,
  type ThaiSegmentRateKey,
} from "@/lib/constants/thai-segment-rates";
import {
  saveExchangeRate,
  saveFuelPrice,
  saveOperationalFreightSettings,
} from "@/app/actions/freight-settings";
import { saveGlobalCostSettings } from "@/app/actions/global-cost-settings";
import { GlobalCostSettingsSection } from "@/components/settings/GlobalCostSettingsSection";
import type { GlobalCostSettingRow } from "@/lib/global-cost-settings-service";
import type { OperationalSettingsValues } from "@/lib/constants/operational-settings";

interface ExchangeRateRow {
  id: string;
  yearMonth: string;
  rate: number;
}

interface ExchangeAlert {
  currentYearMonth: string;
  missing: boolean;
  currentRate: number | null;
}

interface ThaiSegmentRateValues {
  songkhlaRateTong: number;
  songkhlaRateBox: number;
  pattaniRateTong: number;
  pattaniRateBox: number;
}

interface OperationsSettingsSectionProps {
  exchangeRates: ExchangeRateRow[];
  exchangeAlert: ExchangeAlert;
  fuelPrice: {
    myrPerLiter: number;
    thbPerLiter: number;
  };
  operationalSettings: Pick<
    OperationalSettingsValues,
    "mcThirdPartyRateTong" | "mcThirdPartyRateBox"
  >;
  thaiSegmentRates: ThaiSegmentRateValues;
  globalCosts: GlobalCostSettingRow[];
}

const THAI_SEGMENT_FORM_FIELDS: {
  key: ThaiSegmentRateKey;
  formKey: keyof ThaiSegmentRateValues;
}[] = [
  { key: "songkhla_rate_tong", formKey: "songkhlaRateTong" },
  { key: "songkhla_rate_box", formKey: "songkhlaRateBox" },
  { key: "pattani_rate_tong", formKey: "pattaniRateTong" },
  { key: "pattani_rate_box", formKey: "pattaniRateBox" },
];

function formatYearMonthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split("-");
  return `${year}年${Number(month)}月`;
}

export function OperationsSettingsSection({
  exchangeRates,
  exchangeAlert,
  fuelPrice,
  operationalSettings,
  thaiSegmentRates,
  globalCosts,
}: OperationsSettingsSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [fuelForm, setFuelForm] = useState({
    myrPerLiter: String(fuelPrice.myrPerLiter),
    thbPerLiter: String(fuelPrice.thbPerLiter),
  });
  const [mcTransferForm, setMcTransferForm] = useState({
    mcThirdPartyRateTong: "",
    mcThirdPartyRateBox: "",
  });
  const [thaiSegmentForm, setThaiSegmentForm] = useState({
    songkhlaRateTong: "",
    songkhlaRateBox: "",
    pattaniRateTong: "",
    pattaniRateBox: "",
  });

  const [form, setForm] = useState({
    yearMonth: exchangeAlert.currentYearMonth,
    rate: String(DEFAULT_EXCHANGE_RATE),
  });

  function optionalRateString(value: number | null | undefined) {
    return value != null ? String(value) : "";
  }

  function parseRateInput(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error("费率不能为负数 Rate cannot be negative");
    }
    return parsed;
  }

  function parseOptionalRateInput(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error("费率不能为负数 Rate cannot be negative");
    }
    return parsed;
  }

  useEffect(() => {
    setMcTransferForm({
      mcThirdPartyRateTong: optionalRateString(
        operationalSettings.mcThirdPartyRateTong
      ),
      mcThirdPartyRateBox: optionalRateString(
        operationalSettings.mcThirdPartyRateBox
      ),
    });
    setThaiSegmentForm({
      songkhlaRateTong: String(thaiSegmentRates.songkhlaRateTong),
      songkhlaRateBox: String(thaiSegmentRates.songkhlaRateBox),
      pattaniRateTong: String(thaiSegmentRates.pattaniRateTong),
      pattaniRateBox: String(thaiSegmentRates.pattaniRateBox),
    });
  }, [
    operationalSettings.mcThirdPartyRateTong,
    operationalSettings.mcThirdPartyRateBox,
    thaiSegmentRates.songkhlaRateTong,
    thaiSegmentRates.songkhlaRateBox,
    thaiSegmentRates.pattaniRateTong,
    thaiSegmentRates.pattaniRateBox,
  ]);

  function refresh() {
    router.refresh();
  }

  useEffect(() => {
    setFuelForm({
      myrPerLiter: String(fuelPrice.myrPerLiter),
      thbPerLiter: String(fuelPrice.thbPerLiter),
    });
  }, [fuelPrice.myrPerLiter, fuelPrice.thbPerLiter]);

  function runAction(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setDialogOpen(false);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-haidee-border bg-white p-4">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-haidee-text">
            油价设定 Fuel Prices
          </h4>
          <p className="text-xs text-haidee-muted">
            油价浮动，请每月更新。车辆主数据自动带出当前油价。
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            马来西亚油价 Malaysia Diesel (MYR/L)
            <Input
              value={fuelForm.myrPerLiter}
              onChange={(e) =>
                setFuelForm({ ...fuelForm, myrPerLiter: e.target.value })
              }
              className="min-h-[44px] font-mono"
            />
          </label>
          <label className="block space-y-1 text-sm">
            泰国油价 Thailand Diesel (THB/L)
            <Input
              value={fuelForm.thbPerLiter}
              onChange={(e) =>
                setFuelForm({ ...fuelForm, thbPerLiter: e.target.value })
              }
              className="min-h-[44px] font-mono"
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            className="bg-haidee-blue text-white"
            disabled={isPending}
            onClick={() =>
              runAction(async () => {
                const myrPerLiter = Number(fuelForm.myrPerLiter);
                const thbPerLiter = Number(fuelForm.thbPerLiter);
                if (!Number.isFinite(myrPerLiter) || myrPerLiter <= 0) {
                  throw new Error(
                    "马来西亚油价必须大于 0 MYR fuel price must be greater than 0"
                  );
                }
                if (!Number.isFinite(thbPerLiter) || thbPerLiter <= 0) {
                  throw new Error(
                    "泰国油价必须大于 0 THB fuel price must be greater than 0"
                  );
                }
                await saveFuelPrice({ myrPerLiter, thbPerLiter });
              })
            }
          >
            保存油价 Save Fuel Prices
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-haidee-border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-haidee-text">
              月度汇率 Monthly Exchange Rate
            </h4>
            <p className="text-xs text-haidee-muted">
              THB ÷ 汇率 = MYR。修改某月汇率后，该月 THB→MYR 换算自动更新。
            </p>
          </div>
          <Button
            type="button"
            className="gap-2 bg-haidee-blue text-white"
            onClick={() => {
              setEditId(undefined);
              setForm({
                yearMonth: exchangeAlert.currentYearMonth,
                rate: String(DEFAULT_EXCHANGE_RATE),
              });
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            设定汇率
          </Button>
        </div>

        {exchangeAlert.missing && (
          <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatYearMonthLabel(exchangeAlert.currentYearMonth)} 尚未设定汇率，请尽快设置。
            默认 {DEFAULT_EXCHANGE_RATE.toFixed(2)}。
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-haidee-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead>月份 Month</TableHead>
                <TableHead>汇率 Rate (THB÷?=MYR)</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exchangeRates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-haidee-muted">
                    暂无汇率记录 No exchange rates
                  </TableCell>
                </TableRow>
              ) : (
                exchangeRates.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">
                        {formatYearMonthLabel(row.yearMonth)}
                      </div>
                      <div className="font-mono text-xs text-haidee-muted">
                        {row.yearMonth}
                      </div>
                      {row.yearMonth === exchangeAlert.currentYearMonth && (
                        <span className="mt-1 inline-flex rounded bg-haidee-blue/10 px-2 py-0.5 text-xs text-haidee-blue">
                          当月 Current
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-lg">
                      {row.rate.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => {
                          setEditId(row.id);
                          setForm({
                            yearMonth: row.yearMonth,
                            rate: String(row.rate),
                          });
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <GlobalCostSettingsSection
        settings={globalCosts}
        title="全局费用 Global Costs"
        tripCostsOnly
      />

      <div className="rounded-lg border border-haidee-border bg-white p-4">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-haidee-text">
            MC路线转车设定 MC Transfer Settings
          </h4>
          <p className="text-xs text-haidee-muted">
            MC 市场转第三方运输的固定费率（按桶/箱）。
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            MC 第三方费率/桶 Tong (MYR)
            <Input
              value={mcTransferForm.mcThirdPartyRateTong}
              onChange={(e) =>
                setMcTransferForm({
                  ...mcTransferForm,
                  mcThirdPartyRateTong: e.target.value,
                })
              }
              placeholder="留空不计算"
              className="min-h-[44px] font-mono"
            />
          </label>
          <label className="block space-y-1 text-sm">
            MC 第三方费率/箱 Box (MYR)
            <Input
              value={mcTransferForm.mcThirdPartyRateBox}
              onChange={(e) =>
                setMcTransferForm({
                  ...mcTransferForm,
                  mcThirdPartyRateBox: e.target.value,
                })
              }
              placeholder="留空不计算"
              className="min-h-[44px] font-mono"
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            className="bg-haidee-blue text-white"
            disabled={isPending}
            onClick={() =>
              runAction(async () => {
                await saveOperationalFreightSettings({
                  mcThirdPartyRateTong: parseOptionalRateInput(
                    mcTransferForm.mcThirdPartyRateTong
                  ),
                  mcThirdPartyRateBox: parseOptionalRateInput(
                    mcTransferForm.mcThirdPartyRateBox
                  ),
                });
              })
            }
          >
            保存 MC 转车设定 Save MC Transfer
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-haidee-border bg-white p-4">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-haidee-text">
            泰国段车力设定 Thai Segment Freight
          </h4>
          <p className="text-xs text-haidee-muted">
            内部成本分拆：按收货地点将总车力拆为泰国段与马来西亚段（THB 费率）。不影响客户账单。
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {THAI_SEGMENT_FORM_FIELDS.map(({ key, formKey }) => (
            <label key={key} className="block space-y-1 text-sm">
              {THAI_SEGMENT_RATE_UI[key].label} (THB)
              <Input
                value={thaiSegmentForm[formKey]}
                onChange={(e) =>
                  setThaiSegmentForm({
                    ...thaiSegmentForm,
                    [formKey]: e.target.value,
                  })
                }
                className="min-h-[44px] font-mono"
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            className="bg-haidee-blue text-white"
            disabled={isPending}
            onClick={() =>
              runAction(async () => {
                await saveGlobalCostSettings({
                  settings: THAI_SEGMENT_RATE_KEYS.map((key) => {
                    const formKey = THAI_SEGMENT_FORM_FIELDS.find(
                      (field) => field.key === key
                    )!.formKey;
                    return {
                      key,
                      valueMyr: parseRateInput(thaiSegmentForm[formKey]),
                    };
                  }),
                });
              })
            }
          >
            保存泰国段车力设定 Save Thai Segment Freight
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editId ? "编辑汇率 Edit Exchange Rate" : "设定汇率 Set Exchange Rate"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1 text-sm">
              月份 Month (YYYY-MM)
              <Input
                value={form.yearMonth}
                onChange={(e) => setForm({ ...form, yearMonth: e.target.value })}
                placeholder="2026-06"
                className="min-h-[44px] font-mono"
              />
            </label>
            <label className="block space-y-1 text-sm">
              汇率 Rate
              <Input
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                className="min-h-[44px] font-mono"
              />
            </label>
            <p className="text-xs text-haidee-muted">
              换算公式：MYR = THB ÷ 汇率。例：汇率 8.20 → 820 THB = 100 MYR。
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              className="bg-haidee-blue text-white"
              disabled={isPending}
              onClick={() =>
                runAction(async () => {
                  const rate = Number(form.rate);
                  if (!Number.isFinite(rate) || rate <= 0) {
                    throw new Error("汇率必须大于 0 Exchange rate must be greater than 0");
                  }
                  await saveExchangeRate({
                    id: editId,
                    yearMonth: form.yearMonth,
                    rate,
                  });
                })
              }
            >
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
