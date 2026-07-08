"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getThaiCostRatesForMonth,
  lockThaiCostMonth,
  saveThaiCostRateSettings,
} from "@/app/actions/thai-cost-phase2";
import type { ThaiCostRates } from "@/lib/thai-cost/rate-settings";
import type { ThaiRouteMasterRow } from "@/app/actions/thai-cost-phase2";
import { ThaiRoutesSettingsSection } from "@/components/thai-cost/ThaiRoutesSettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ThaiCostSettingsViewProps {
  initialRates: ThaiCostRates;
  thaiRoutes: ThaiRouteMasterRow[];
  canWrite: boolean;
  year: number;
  month: number;
  monthRatesLocked: boolean;
}

export function ThaiCostSettingsView({
  initialRates,
  thaiRoutes,
  canWrite,
  year,
  month,
  monthRatesLocked,
}: ThaiCostSettingsViewProps) {
  const router = useRouter();
  const [rates, setRates] = useState(initialRates);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lockYear, setLockYear] = useState(year);
  const [lockMonth, setLockMonth] = useState(month);

  function field(
    key: keyof ThaiCostRates,
    label: string
  ) {
    return (
      <label className="space-y-1 text-sm">
        <span>{label}</span>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={rates[key]}
          disabled={!canWrite}
          onChange={(e) =>
            setRates((r) => ({ ...r, [key]: Number(e.target.value) }))
          }
        />
      </label>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-haidee-muted">
        此处修改的是<strong>以后默认费率</strong>。已锁定月份的月度汇总 / P&L
        使用该月快照费率，不会随设置漂移。日薪单价存在出勤记录行上，不受影响。
      </p>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </p>
      )}

      <ThaiRoutesSettingsSection routes={thaiRoutes} canWrite={canWrite} />

      <div className="rounded-lg border border-haidee-border p-4">
        <h3 className="text-sm font-medium">Sadao 搬运费率（THB，盒子=小桶）</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {field("handlingSmallWeekday", "小桶/盒子 平日")}
          {field("handlingSmallHoliday", "小桶/盒子 假日")}
          {field("handlingLargeWeekday", "大桶 平日")}
          {field("handlingLargeHoliday", "大桶 假日")}
        </div>
      </div>

      <div className="rounded-lg border border-haidee-border p-4">
        <h3 className="text-sm font-medium">宋卡搬运费率（THB，不分大小桶）</h3>
        <p className="mt-1 text-xs text-haidee-muted">
          计费：(小桶+大桶)×桶费率 + 盒子×盒子费率。派车回填仍按桶型分小/大/盒存储。
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {field("songkhlaCrateRate", "桶（小+大合计）")}
          {field("songkhlaBoxRate", "盒子")}
        </div>
      </div>

      <div className="rounded-lg border border-haidee-border p-4">
        <h3 className="text-sm font-medium">
          司机趟次提成（按趟计，THB/趟）
        </h3>
        <p className="mt-1 text-xs text-haidee-muted">
          付给泰国正式司机的每趟提成。与营运设定里的「泰国段车力分拆费率（按桶/盒）」不同。
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {field("driverTripSongkhla", "宋卡 / 趟")}
          {field("driverTripPattani", "北大年 / 趟")}
        </div>
      </div>

      <div className="rounded-lg border border-haidee-border p-4">
        <h3 className="text-sm font-medium">
          北大年费率（THB，无假日档）
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {field("pattaniContractorCrate", "外包商 / 桶")}
          {field("pattaniContractorBox", "外包商 / 盒子")}
          {field("pattaniSakriCrate", "SAKRI 提成 / 桶（盒子=0）")}
        </div>
      </div>

      <div className="rounded-lg border border-haidee-border p-4">
        <h3 className="text-sm font-medium">
          泰国成本大桶桶型（与马来西亚卸货费分类独立）
        </h3>
        <p className="mt-1 text-xs text-haidee-muted">
          逗号分隔桶型代码，默认 VIO,BS,GKS。仅影响 Sadao/宋卡从派车回填时的大小桶归类，
          不影响马来西亚下货费（仍为 VIO/BS）。
        </p>
        <label className="mt-3 block space-y-1 text-sm">
          <span>大桶代码 large_tong_type_codes</span>
          <Input
            value={rates.largeTongTypeCodes.join(",")}
            disabled={!canWrite}
            onChange={(e) =>
              setRates((r) => ({
                ...r,
                largeTongTypeCodes: e.target.value
                  .split(/[,;\s]+/)
                  .map((c) => c.trim().toUpperCase())
                  .filter(Boolean),
              }))
            }
            placeholder="VIO,BS,GKS"
          />
        </label>
      </div>

      {canWrite && (
        <Button
          type="button"
          disabled={isPending}
          className="bg-haidee-blue text-white"
          onClick={() => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              try {
                const saved = await saveThaiCostRateSettings(rates);
                setRates(saved);
                setMessage("默认费率已保存");
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "保存失败");
              }
            });
          }}
        >
          保存默认费率
        </Button>
      )}

      <div className="rounded-lg border border-haidee-border bg-haidee-surface/40 p-4">
        <h3 className="text-sm font-medium">锁定当月费率 + 内部固定成本快照</h3>
        <p className="mt-1 text-xs text-haidee-muted">
          手动触发，写入搬运/趟次费率快照，并按宋卡/北大年锁定泰国段内部成本（MYR）。
          已锁定月份默认不覆盖；需重锁请勾选强制。
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            年
            <Input
              type="number"
              className="w-24"
              value={lockYear}
              onChange={(e) => setLockYear(Number(e.target.value) || lockYear)}
            />
          </label>
          <label className="space-y-1 text-sm">
            月
            <Input
              type="number"
              min={1}
              max={12}
              className="w-20"
              value={lockMonth}
              onChange={(e) => setLockMonth(Number(e.target.value) || lockMonth)}
            />
          </label>
          {canWrite && (
            <Button
              type="button"
              disabled={isPending}
              className="bg-haidee-blue text-white"
              onClick={() => {
                setError(null);
                setMessage(null);
                startTransition(async () => {
                  try {
                    const result = await lockThaiCostMonth({
                      year: lockYear,
                      month: lockMonth,
                    });
                    const segs = result.segmentSnapshots
                      .map(
                        (s) =>
                          `${s.pickupLocation}=${s.totalAmountMyr} MYR${s.created ? "" : " (已存在)"}`
                      )
                      .join(", ");
                    setMessage(
                      `已锁定 ${result.yearMonth}：费率快照 + 内部成本 [${segs}]`
                    );
                    router.refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "锁定失败");
                  }
                });
              }}
            >
              生成/锁定当月快照
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-haidee-muted">
          当前查看月 {year}-{String(month).padStart(2, "0")} 费率状态：{" "}
          {monthRatesLocked ? "已锁定（月度快照）" : "未锁定（使用当前默认费率）"}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-2"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const r = await getThaiCostRatesForMonth({
                year: lockYear,
                month: lockMonth,
              });
              setMessage(
                `${lockYear}-${String(lockMonth).padStart(2, "0")} source=${r.source} locked=${r.locked}`
              );
            });
          }}
        >
          查询该月费率来源
        </Button>
      </div>
    </div>
  );
}
