"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/components/shared/locale-context";
import { PnlIncompleteWarning } from "@/components/thai-cost/PnlIncompleteWarning";
import { DispatchCrossCheckBanner } from "@/components/thai-cost/DispatchCrossCheckBanner";
import type { DispatchCrossCheckResult } from "@/lib/thai-cost/dispatch-cross-check";
import type { PattaniPnlDetail } from "@/lib/thai-cost/pattani-pnl";
import { Input } from "@/components/ui/input";

function money(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PattaniSummaryView({
  pnl,
  crossCheck,
}: {
  pnl: PattaniPnlDetail;
  crossCheck?: DispatchCrossCheckResult | null;
}) {
  const router = useRouter();
  const { tLocal } = useT();
  const r = pnl.real;

  const ratesSource = r.rates.locked
    ? tLocal("thaiCost.common.lockedSnapshot")
    : tLocal("thaiCost.common.defaultRates");

  return (
    <div className="space-y-6">
      <p className="text-sm text-haidee-muted">
        {tLocal("thaiCost.pattaniSummary.intro", { ratesSource })}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          {tLocal("thaiCost.common.year")}
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
          {tLocal("thaiCost.common.month")}
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

      <DispatchCrossCheckBanner result={crossCheck ?? null} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-haidee-muted">
            {tLocal("thaiCost.common.internalFixedCost")}
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold">
            {pnl.internalCostMyr == null
              ? tLocal("thaiCost.pattaniSummary.notLockedLabel")
              : money(pnl.internalCostMyr)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-haidee-muted">
            {tLocal("thaiCost.common.realCost")}
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold">
            {money(pnl.realCostThb)} THB
          </p>
          <p className="mt-1 text-xs text-haidee-muted">
            {tLocal("thaiCost.songkhlaSummary.realCostApprox", {
              amount: money(pnl.realCostMyr),
              rate: String(pnl.exchangeRate),
            })}
          </p>
        </div>
        <div className="rounded-lg border-2 border-haidee-blue bg-haidee-blue/5 p-4">
          <p className="text-sm text-haidee-muted">
            {tLocal("thaiCost.pattaniSummary.pnlTitle")}
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-haidee-blue">
            {pnl.pnlMyr == null ? "—" : money(pnl.pnlMyr)}
          </p>
        </div>
      </div>

      <PnlIncompleteWarning message={pnl.completeness.incompleteWarning} />

      <div className="rounded-lg border p-4 text-sm">
        <h3 className="font-medium">
          {tLocal("thaiCost.pattaniSummary.realCostBreakdown")}
        </h3>
        <ul className="mt-3 space-y-2">
          <li className="flex justify-between">
            <span>{tLocal("thaiCost.pattaniSummary.sakriMonthly")}</span>
            <span className="font-mono">{money(r.sakriMonthlyWageThb)}</span>
          </li>
          <li className="flex justify-between">
            <span>{tLocal("thaiCost.pattaniSummary.sakriCommission")}</span>
            <span className="font-mono">{money(r.sakriCommissionThb)}</span>
          </li>
          <li className="flex justify-between">
            <span>{tLocal("thaiCost.pattaniSummary.contractorFee")}</span>
            <span className="font-mono">{money(r.contractorThb)}</span>
          </li>
          <li className="flex justify-between">
            <span>{tLocal("thaiCost.pattaniSummary.driverBaseAllocated")}</span>
            <span className="font-mono">
              {money(r.driverBaseWageAllocatedThb)}
            </span>
          </li>
          <li className="flex justify-between">
            <span>{tLocal("thaiCost.pattaniSummary.driverTripCommission")}</span>
            <span className="font-mono">
              {money(r.driverTripCommissionThb)}
            </span>
          </li>
          <li className="flex justify-between">
            <span>{tLocal("thaiCost.songkhlaSummary.rentedCost")}</span>
            <span className="font-mono">{money(r.rentedVehicleCostThb)}</span>
          </li>
          <li className="flex justify-between border-t pt-2 font-medium">
            <span>{tLocal("thaiCost.songkhlaSummary.realCostTotal")}</span>
            <span className="font-mono">{money(r.realCostTotalThb)}</span>
          </li>
        </ul>
      </div>

      {r.workers.length > 0 && (
        <div className="rounded-lg border p-4 text-sm">
          <h3 className="font-medium">
            {tLocal("thaiCost.pattaniSummary.monthlyWorkers")}
          </h3>
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
          <h3 className="font-medium">
            {tLocal("thaiCost.songkhlaSummary.driverDetail")}
          </h3>
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
                  {tLocal("thaiCost.pattaniSummary.driverLine", {
                    pt: String(d.pattaniTrips),
                    base: money(d.baseWageAllocatedThb),
                    comm: money(d.tripCommissionThb),
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
