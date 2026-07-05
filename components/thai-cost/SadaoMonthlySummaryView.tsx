"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/components/shared/locale-context";
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
  const { tLocal } = useT();

  function changeMonth(nextYear: number, nextMonth: number) {
    router.push(
      `/thai-cost/sadao-summary?year=${nextYear}&month=${nextMonth}`
    );
  }

  const ratesSource = summary.rates.locked
    ? tLocal("thaiCost.common.lockedSnapshot")
    : tLocal("thaiCost.sadaoSummary.ratesUnlocked");

  const cards = [
    {
      key: "monthlyWorkers",
      label: tLocal("thaiCost.sadaoSummary.cardMonthlyWorkers"),
      value: summary.monthlyWorkerTotalThb,
      hint: tLocal("thaiCost.sadaoSummary.workersCount", {
        count: String(summary.monthlyWorkers.length),
      }),
    },
    {
      key: "dailyWage",
      label: tLocal("thaiCost.sadaoSummary.cardDailyWage"),
      value: summary.dailyLaborWageTotalThb,
      hint: tLocal("thaiCost.sadaoSummary.attendanceDays", {
        count: String(summary.attendanceDays),
      }),
    },
    {
      key: "lunch",
      label: tLocal("thaiCost.sadaoSummary.cardLunch"),
      value: summary.dailyLaborLunchTotalThb,
      hint: tLocal("thaiCost.sadaoSummary.rosterLunch", {
        count: String(summary.dailyLaborRosterCount),
        amount: String(DEFAULT_LUNCH_ALLOWANCE_THB),
      }),
    },
    {
      key: "handling",
      label: tLocal("thaiCost.sadaoSummary.cardHandling"),
      value: summary.handlingCommissionTotalThb,
      hint: tLocal("thaiCost.sadaoSummary.handlingDays", {
        count: String(summary.handlingDays),
      }),
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-haidee-muted">
        {tLocal("thaiCost.sadaoSummary.intro", { ratesSource })}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span>{tLocal("thaiCost.common.year")}</span>
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
          <span>{tLocal("thaiCost.common.month")}</span>
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
            key={c.key}
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
          {tLocal("thaiCost.sadaoSummary.monthTotal")}
        </p>
        <p className="mt-2 font-mono text-3xl font-bold text-haidee-blue">
          {money(summary.totalCostThb)} THB
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-haidee-border p-4">
          <h3 className="text-sm font-medium">
            {tLocal("thaiCost.sadaoSummary.monthlyWorkerDetail")}
          </h3>
          <ul className="mt-2 space-y-2 text-sm">
            <li className="flex justify-between gap-4 text-haidee-muted">
              <span>{tLocal("thaiCost.sadaoSummary.wageTotal")}</span>
              <span className="font-mono">{money(summary.monthlyWageTotalThb)}</span>
            </li>
            <li className="flex justify-between gap-4 text-haidee-muted">
              <span>{tLocal("thaiCost.sadaoSummary.lunchTotalMonthly")}</span>
              <span className="font-mono">{money(summary.monthlyLunchTotalThb)}</span>
            </li>
            <li className="flex justify-between gap-4 text-haidee-muted">
              <span>{tLocal("thaiCost.sadaoSummary.fuelTotal")}</span>
              <span className="font-mono">{money(summary.monthlyFuelTotalThb)}</span>
            </li>
            <li className="flex justify-between gap-4 text-haidee-muted">
              <span>{tLocal("thaiCost.sadaoSummary.rentRoomTotal")}</span>
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
                    {tLocal("thaiCost.sadaoSummary.workerAllowanceLine", {
                      wage: money(w.monthlyWage),
                      lunch: money(w.lunchAllowance),
                      fuel: money(w.fuelAllowance),
                      rent: money(w.rentRoomAllowance),
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-haidee-border p-4">
          <h3 className="text-sm font-medium">
            {tLocal("thaiCost.sadaoSummary.handlingBreakdown")}
          </h3>
          <ul className="mt-2 space-y-2 text-sm">
            <li className="flex justify-between gap-4">
              <span>{tLocal("thaiCost.sadaoSummary.smallCommission")}</span>
              <span className="font-mono">
                {money(summary.handlingSmallCommissionThb)}
              </span>
            </li>
            <li className="flex justify-between gap-4">
              <span>{tLocal("thaiCost.sadaoSummary.largeCommission")}</span>
              <span className="font-mono">
                {money(summary.handlingLargeCommissionThb)}
              </span>
            </li>
            <li className="flex justify-between gap-4">
              <span>{tLocal("thaiCost.sadaoSummary.boxCommission")}</span>
              <span className="font-mono">
                {money(summary.handlingBoxCommissionThb)}
              </span>
            </li>
            <li className="flex justify-between gap-4 border-t border-haidee-border pt-2 font-medium">
              <span>{tLocal("thaiCost.sadaoSummary.commissionTotal")}</span>
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
