"use client";

import { useRouter } from "next/navigation";
import type { SongkhlaPnlDetail } from "@/lib/thai-cost/songkhla-pnl";
import { Input } from "@/components/ui/input";

function money(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function SongkhlaSummaryView({ pnl }: { pnl: SongkhlaPnlDetail }) {
  const router = useRouter();
  const r = pnl.real;

  return (
    <div className="space-y-6">
      <p className="text-sm text-haidee-muted">
        宋卡 P&L = 内部固定成本快照(MYR) − 宋卡真实成本(THB÷汇率)。费率来源：
        {r.rates.locked ? "当月已锁定快照" : "当前默认设置（未锁定）"}。
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          年
          <Input
            type="number"
            className="w-24"
            value={pnl.year}
            onChange={(e) =>
              router.push(
                `/thai-cost/songkhla-summary?year=${Number(e.target.value) || pnl.year}&month=${pnl.month}`
              )
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          月
          <Input
            type="number"
            min={1}
            max={12}
            className="w-20"
            value={pnl.month}
            onChange={(e) =>
              router.push(
                `/thai-cost/songkhla-summary?year=${pnl.year}&month=${Number(e.target.value) || pnl.month}`
              )
            }
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-haidee-border p-4">
          <p className="text-sm text-haidee-muted">内部固定成本 (MYR)</p>
          <p className="mt-2 font-mono text-2xl font-semibold">
            {pnl.internalCostMyr == null
              ? "未锁定"
              : money(pnl.internalCostMyr)}
          </p>
          <p className="mt-1 text-xs text-haidee-muted">
            {pnl.internalCostLocked
              ? "已锁定快照"
              : "请在「泰国成本设置」生成当月快照"}
          </p>
        </div>
        <div className="rounded-lg border border-haidee-border p-4">
          <p className="text-sm text-haidee-muted">真实成本</p>
          <p className="mt-2 font-mono text-2xl font-semibold">
            {money(pnl.realCostThb)} THB
          </p>
          <p className="mt-1 text-xs text-haidee-muted">
            ≈ {money(pnl.realCostMyr)} MYR（汇率 {pnl.exchangeRate}）
          </p>
        </div>
        <div className="rounded-lg border-2 border-haidee-blue bg-haidee-blue/5 p-4">
          <p className="text-sm text-haidee-muted">宋卡 P&L (MYR)</p>
          <p className="mt-2 font-mono text-2xl font-bold text-haidee-blue">
            {pnl.pnlMyr == null ? "—" : money(pnl.pnlMyr)}
          </p>
          <p className="mt-1 text-xs text-haidee-muted">
            正数=内部成本覆盖真实成本有余
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-haidee-border p-4 text-sm">
          <h3 className="font-medium">真实成本明细 (THB)</h3>
          <ul className="mt-2 space-y-1">
            <li className="flex justify-between">
              <span>月薪工人合计</span>
              <span className="font-mono">{money(r.monthlyWorkerTotalThb)}</span>
            </li>
            <li className="flex justify-between">
              <span>日薪工资</span>
              <span className="font-mono">{money(r.dailyLaborWageTotalThb)}</span>
            </li>
            <li className="flex justify-between">
              <span>日薪 LUNCH</span>
              <span className="font-mono">{money(r.dailyLaborLunchTotalThb)}</span>
            </li>
            <li className="flex justify-between">
              <span>搬运提成</span>
              <span className="font-mono">
                {money(r.handlingCommissionTotalThb)}
              </span>
            </li>
            <li className="flex justify-between text-xs text-haidee-muted">
              <span>　小桶 / 大桶 / 盒子</span>
              <span className="font-mono">
                {money(r.handlingSmallCommissionThb)} /{" "}
                {money(r.handlingLargeCommissionThb)} /{" "}
                {money(r.handlingBoxCommissionThb)}
              </span>
            </li>
            <li className="flex justify-between">
              <span>司机底薪(按趟次分摊)</span>
              <span className="font-mono">
                {money(r.driverBaseWageAllocatedThb)}
              </span>
            </li>
            <li className="flex justify-between">
              <span>司机宋卡趟次提成</span>
              <span className="font-mono">
                {money(r.driverTripCommissionThb)}
              </span>
            </li>
            <li className="flex justify-between border-t border-haidee-border pt-1 font-medium">
              <span>真实成本合计</span>
              <span className="font-mono">{money(r.realCostTotalThb)}</span>
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-haidee-border p-4 text-sm">
          <h3 className="font-medium">司机明细</h3>
          {r.drivers.length === 0 ? (
            <p className="mt-2 text-haidee-muted">当月无趟次记录</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {r.drivers.map((d) => (
                <li key={d.driverId}>
                  <div className="flex justify-between font-medium">
                    <span>{d.name}</span>
                    <span className="font-mono">
                      {money(d.baseWageAllocatedThb + d.tripCommissionThb)}
                    </span>
                  </div>
                  <div className="text-xs text-haidee-muted">
                    宋卡 {d.songkhlaTrips} 趟 / 北大年 {d.pattaniTrips} 趟 ·
                    底薪分摊 {money(d.baseWageAllocatedThb)} · 提成{" "}
                    {money(d.tripCommissionThb)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
