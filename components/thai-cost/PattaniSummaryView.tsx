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

  return (
    <div className="space-y-6">
      <p className="text-sm text-haidee-muted">
        {tLocal("thaiCost.pattaniSummary.introVehiclePnl")}
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
            {tLocal("thaiCost.vehiclePnl.income")}
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold">
            {money(pnl.incomeThb)} THB
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-haidee-muted">
            {tLocal("thaiCost.vehiclePnl.cost")}
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold">
            {money(pnl.costThb)} THB
          </p>
        </div>
        <div className="rounded-lg border-2 border-haidee-blue bg-haidee-blue/5 p-4">
          <p className="text-sm text-haidee-muted">
            {tLocal("thaiCost.pattaniSummary.pnlTitle")}
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-haidee-blue">
            {money(pnl.profitThb)} THB
          </p>
        </div>
      </div>

      <PnlIncompleteWarning message={pnl.completeness.incompleteWarning} />

      <div className="rounded-lg border p-4 text-sm">
        <h3 className="font-medium">
          {tLocal("thaiCost.vehiclePnl.costBreakdown")}
        </h3>
        <ul className="mt-3 space-y-2">
          <li className="flex justify-between">
            <span>{tLocal("thaiCost.vehiclePnl.vehicleCost")}</span>
            <span className="font-mono">{money(pnl.vehicleCostThb)}</span>
          </li>
          <li className="flex justify-between">
            <span>{tLocal("thaiCost.vehiclePnl.driverTripBudget")}</span>
            <span className="font-mono">{money(pnl.driverTripBudgetThb)}</span>
          </li>
          <li className="flex justify-between">
            <span>{tLocal("thaiCost.pattaniSummary.driverBaseAllocated")}</span>
            <span className="font-mono">
              {money(pnl.driverBaseWageAllocatedThb)}
            </span>
          </li>
          <li className="flex justify-between">
            <span>{tLocal("thaiCost.vehiclePnl.handlingFee")}</span>
            <span className="font-mono">{money(pnl.handlingFeeThb)}</span>
          </li>
          <li className="flex justify-between">
            <span>{tLocal("thaiCost.vehiclePnl.monthlyWorkers")}</span>
            <span className="font-mono">
              {money(pnl.monthlyWorkerAllocatedThb)}
            </span>
          </li>
          <li className="flex justify-between border-t pt-2 font-medium">
            <span>{tLocal("thaiCost.vehiclePnl.cost")}</span>
            <span className="font-mono">{money(pnl.costThb)}</span>
          </li>
        </ul>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-haidee-surface/60 text-left">
            <tr>
              <th className="px-3 py-2">{tLocal("thaiCost.common.date")}</th>
              <th className="px-3 py-2">{tLocal("thaiCost.driverTrips.plate")}</th>
              <th className="px-3 py-2">{tLocal("thaiCost.driverTrips.driver")}</th>
              <th className="px-3 py-2 text-right">
                {tLocal("thaiCost.vehiclePnl.crateBox")}
              </th>
              <th className="px-3 py-2 text-right">
                {tLocal("thaiCost.vehiclePnl.income")}
              </th>
              <th className="px-3 py-2 text-right">
                {tLocal("thaiCost.vehiclePnl.cost")}
              </th>
              <th className="px-3 py-2 text-right">
                {tLocal("thaiCost.pattaniSummary.pnlTitle")}
              </th>
            </tr>
          </thead>
          <tbody>
            {pnl.trips.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-haidee-muted">
                  {tLocal("thaiCost.songkhlaSummary.noTrips")}
                </td>
              </tr>
            ) : (
              pnl.trips.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-3 py-2 font-mono">{t.date}</td>
                  <td className="px-3 py-2 font-mono">{t.truckPlate}</td>
                  <td className="px-3 py-2">
                    {t.isRented
                      ? `${t.rentedDriverName ?? "—"} (${tLocal("thaiCost.driverTrips.rentedShort")})`
                      : t.isOtherDriver
                        ? tLocal("thaiCost.driverTrips.otherDriver")
                        : (t.driverName ?? "—")}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {t.crateQty}/{t.boxQty}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {money(t.incomeThb)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {money(t.costThb)}
                    {t.needsReview ? " *" : ""}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono ${
                      t.profitThb >= 0 ? "text-green-700" : "text-haidee-red"
                    }`}
                  >
                    {money(t.profitThb)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
