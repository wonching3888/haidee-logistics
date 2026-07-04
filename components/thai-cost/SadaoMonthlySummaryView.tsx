"use client";

import { useRouter } from "next/navigation";
import type { SadaoMonthlyCostDetail } from "@/lib/thai-cost/sadao-cost-service";
import { Input } from "@/components/ui/input";
import { DEFAULT_LUNCH_ALLOWANCE_THB } from "@/lib/constants/thai-cost";

interface SadaoMonthlySummaryViewProps {
  summary: SadaoMonthlyCostDetail;
}

function money(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function SadaoMonthlySummaryView({
  summary,
}: SadaoMonthlySummaryViewProps) {
  const router = useRouter();

  function changeMonth(nextYear: number, nextMonth: number) {
    router.push(
      `/thai-cost/sadao-summary?year=${nextYear}&month=${nextMonth}`
    );
  }

  const cards = [
    {
      label: "月薪工人合计 (工资+津贴)",
      value: summary.monthlyWorkerTotalThb,
      hint: `${summary.monthlyWorkers.length} 名在职工人`,
    },
    {
      label: "日薪出勤工资",
      value: summary.dailyLaborWageTotalThb,
      hint: `${summary.attendanceDays} 天出勤记录`,
    },
    {
      label: "日薪 LUNCH",
      value: summary.dailyLaborLunchTotalThb,
      hint: `在册 ${summary.dailyLaborRosterCount} 人 × ${DEFAULT_LUNCH_ALLOWANCE_THB}`,
    },
    {
      label: "搬运提成合计",
      value: summary.handlingCommissionTotalThb,
      hint: `${summary.handlingDays} 天搬运记录`,
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-haidee-muted">
        Sadao 当月真实总成本 = 月薪工人(工资+LUNCH+FUEL+RENT ROOM) + 日薪出勤工资
        + 日薪 LUNCH(在册人数×1000) + 搬运提成（小桶/大桶/盒子分列）。
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span>年</span>
          <Input
            type="number"
            className="w-24"
            value={summary.year}
            onChange={(e) =>
              changeMonth(Number(e.target.value) || summary.year, summary.month)
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>月</span>
          <Input
            type="number"
            min={1}
            max={12}
            className="w-20"
            value={summary.month}
            onChange={(e) =>
              changeMonth(
                summary.year,
                Number(e.target.value) || summary.month
              )
            }
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-haidee-border bg-haidee-surface/50 p-4"
          >
            <p className="text-sm text-haidee-muted">{c.label}</p>
            <p className="mt-2 font-mono text-2xl font-semibold">
              {money(c.value)}
            </p>
            <p className="mt-1 text-xs text-haidee-muted">{c.hint}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border-2 border-haidee-blue bg-haidee-blue/5 p-6">
        <p className="text-sm font-medium text-haidee-muted">
          Sadao 当月真实总成本 Total Sadao cost
        </p>
        <p className="mt-2 font-mono text-3xl font-bold text-haidee-blue">
          {money(summary.totalCostThb)} THB
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-haidee-border p-4">
          <h3 className="text-sm font-medium">月薪工人明细（含津贴）</h3>
          <ul className="mt-2 space-y-2 text-sm">
            <li className="flex justify-between gap-4 text-haidee-muted">
              <span>工资合计</span>
              <span className="font-mono">{money(summary.monthlyWageTotalThb)}</span>
            </li>
            <li className="flex justify-between gap-4 text-haidee-muted">
              <span>LUNCH 合计</span>
              <span className="font-mono">{money(summary.monthlyLunchTotalThb)}</span>
            </li>
            <li className="flex justify-between gap-4 text-haidee-muted">
              <span>FUEL 合计</span>
              <span className="font-mono">{money(summary.monthlyFuelTotalThb)}</span>
            </li>
            <li className="flex justify-between gap-4 text-haidee-muted">
              <span>RENT ROOM 合计</span>
              <span className="font-mono">
                {money(summary.monthlyRentRoomTotalThb)}
              </span>
            </li>
          </ul>
          {summary.monthlyWorkers.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-haidee-border pt-3 text-sm">
              {summary.monthlyWorkers.map((w) => (
                <li key={w.id} className="space-y-0.5">
                  <div className="flex justify-between gap-4 font-medium">
                    <span>{w.name}</span>
                    <span className="font-mono">{money(w.totalThb)}</span>
                  </div>
                  <div className="text-xs text-haidee-muted">
                    工资 {money(w.monthlyWage)} · LUNCH {money(w.lunchAllowance)}{" "}
                    · FUEL {money(w.fuelAllowance)} · RENT{" "}
                    {money(w.rentRoomAllowance)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-haidee-border p-4">
          <h3 className="text-sm font-medium">搬运提成明细（分品类）</h3>
          <ul className="mt-2 space-y-2 text-sm">
            <li className="flex justify-between gap-4">
              <span>小桶提成</span>
              <span className="font-mono">
                {money(summary.handlingSmallCommissionThb)}
              </span>
            </li>
            <li className="flex justify-between gap-4">
              <span>大桶提成</span>
              <span className="font-mono">
                {money(summary.handlingLargeCommissionThb)}
              </span>
            </li>
            <li className="flex justify-between gap-4">
              <span>盒子提成</span>
              <span className="font-mono">
                {money(summary.handlingBoxCommissionThb)}
              </span>
            </li>
            <li className="flex justify-between gap-4 border-t border-haidee-border pt-2 font-medium">
              <span>提成合计</span>
              <span className="font-mono">
                {money(summary.handlingCommissionTotalThb)}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
