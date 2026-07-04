"use client";

import { useRouter } from "next/navigation";
import { PnlIncompleteWarning } from "@/components/thai-cost/PnlIncompleteWarning";
import type { PattaniPnlDetail } from "@/lib/thai-cost/pattani-pnl";
import { Input } from "@/components/ui/input";

function money(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PattaniSummaryView({ pnl }: { pnl: PattaniPnlDetail }) {
  const router = useRouter();
  const r = pnl.real;

  return (
    <div className="space-y-6">
      <p className="text-sm text-haidee-muted">
        北大年 P&L = 内部固定成本快照(MYR) − 真实成本(THB÷汇率)。无假日费率。费率来源：
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
                `/thai-cost/pattani-summary?year=${Number(e.target.value) || pnl.year}&month=${pnl.month}`
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
                `/thai-cost/pattani-summary?year=${pnl.year}&month=${Number(e.target.value) || pnl.month}`
              )
            }
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-haidee-muted">内部固定成本 (MYR)</p>
          <p className="mt-2 font-mono text-2xl font-semibold">
            {pnl.internalCostMyr == null
              ? "未锁定"
              : money(pnl.internalCostMyr)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-haidee-muted">真实成本</p>
          <p className="mt-2 font-mono text-2xl font-semibold">
            {money(pnl.realCostThb)} THB
          </p>
          <p className="mt-1 text-xs text-haidee-muted">
            ≈ {money(pnl.realCostMyr)} MYR（汇率 {pnl.exchangeRate}）
          </p>
        </div>
        <div className="rounded-lg border-2 border-haidee-blue bg-haidee-blue/5 p-4">
          <p className="text-sm text-haidee-muted">北大年 P&L (MYR)</p>
          <p className="mt-2 font-mono text-2xl font-bold text-haidee-blue">
            {pnl.pnlMyr == null ? "—" : money(pnl.pnlMyr)}
          </p>
        </div>
      </div>

      <PnlIncompleteWarning message={pnl.completeness.incompleteWarning} />

      <div className="rounded-lg border p-4 text-sm">
        <h3 className="font-medium">真实成本分项 (THB)</h3>
        <ul className="mt-3 space-y-2">
          <li className="flex justify-between">
            <span>SAKRI 月薪</span>
            <span className="font-mono">{money(r.sakriMonthlyWageThb)}</span>
          </li>
          <li className="flex justify-between">
            <span>SAKRI 提成（桶×2.2，盒子不计）</span>
            <span className="font-mono">{money(r.sakriCommissionThb)}</span>
          </li>
          <li className="flex justify-between">
            <span>外包费用（桶×20 + 盒子×5）</span>
            <span className="font-mono">{money(r.contractorThb)}</span>
          </li>
          <li className="flex justify-between">
            <span>司机底薪分摊（按北大年趟次比例）</span>
            <span className="font-mono">
              {money(r.driverBaseWageAllocatedThb)}
            </span>
          </li>
          <li className="flex justify-between">
            <span>司机北大年趟次提成</span>
            <span className="font-mono">
              {money(r.driverTripCommissionThb)}
            </span>
          </li>
          <li className="flex justify-between">
            <span>外部租车成本</span>
            <span className="font-mono">{money(r.rentedVehicleCostThb)}</span>
          </li>
          <li className="flex justify-between border-t pt-2 font-medium">
            <span>真实成本合计</span>
            <span className="font-mono">{money(r.realCostTotalThb)}</span>
          </li>
        </ul>
      </div>

      {r.workers.length > 0 && (
        <div className="rounded-lg border p-4 text-sm">
          <h3 className="font-medium">月薪工人</h3>
          <ul className="mt-2 space-y-1">
            {r.workers.map((w) => (
              <li key={w.id} className="flex justify-between">
                <span>{w.name}</span>
                <span className="font-mono">{money(w.totalThb)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.drivers.length > 0 && (
        <div className="rounded-lg border p-4 text-sm">
          <h3 className="font-medium">司机明细</h3>
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
                  北大年 {d.pattaniTrips} 趟 · 底薪分摊{" "}
                  {money(d.baseWageAllocatedThb)} · 提成{" "}
                  {money(d.tripCommissionThb)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
