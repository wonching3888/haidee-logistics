"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/components/shared/locale-context";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DailyOverviewDetail } from "@/lib/thai-cost/daily-overview";

function money(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export function DailyOverviewView({
  overview,
}: {
  overview: DailyOverviewDetail;
}) {
  const router = useRouter();
  const { tLocal } = useT();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          {tLocal("thaiCost.common.date")}
          <Input
            type="date"
            className="w-40"
            value={overview.date}
            onChange={(e) =>
              router.push(
                `/thai-cost/daily-overview?date=${e.target.value}`
              )
            }
          />
        </label>
        <Link
          href={`/thai-cost/sadao-voucher?date=${overview.date}`}
          className="text-sm text-haidee-blue underline"
        >
          {tLocal("thaiCost.dailyOverview.openVoucher")}
        </Link>
      </div>

      {/* ① Sadao */}
      <section className="space-y-3 rounded-lg border border-haidee-border p-4">
        <h3 className="text-lg font-semibold">
          {tLocal("thaiCost.dailyOverview.sadaoTitle")}
        </h3>
        <p className="text-xs text-haidee-muted">
          {tLocal("thaiCost.dailyOverview.sadaoNote")}
        </p>
        {overview.sadao ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="text-sm">
              <p className="text-haidee-muted">
                {tLocal("thaiCost.dailyOverview.billableCrates")}
              </p>
              <p className="font-mono">
                {tLocal("thaiCost.dailyOverview.billableBreakdown", {
                  small: String(overview.sadao.billableSmall),
                  large: String(overview.sadao.billableLarge),
                  box: String(overview.sadao.billableBox),
                })}
              </p>
              <p className="mt-1 text-xs">
                {overview.sadao.holidayRate
                  ? tLocal("thaiCost.common.holidayRate")
                  : tLocal("thaiCost.common.weekdayRate")}
              </p>
            </div>
            <div className="text-sm">
              <p className="text-haidee-muted">
                {tLocal("thaiCost.dailyOverview.dayCommission")}
              </p>
              <p className="font-mono text-lg font-semibold">
                {money(overview.sadao.commissionThb)} THB
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-haidee-muted">
            {tLocal("thaiCost.dailyOverview.noSadaoRecord")}
          </p>
        )}
      </section>

      {/* ② Songkhla */}
      <StationSection
        title={tLocal("thaiCost.dailyOverview.songkhlaTitle")}
        section={overview.songkhla}
        isPattani={false}
      />

      {/* ③ Pattani */}
      <StationSection
        title={tLocal("thaiCost.dailyOverview.pattaniTitle")}
        section={overview.pattani}
        isPattani
      />
    </div>
  );
}

function StationSection({
  title,
  section,
  isPattani,
}: {
  title: string;
  section: DailyOverviewDetail["songkhla"];
  isPattani: boolean;
}) {
  const { tLocal } = useT();

  return (
    <section className="space-y-4 rounded-lg border border-haidee-border p-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      {!section ? (
        <p className="text-sm text-haidee-muted">
          {tLocal("thaiCost.dailyOverview.noStationRecord")}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <p className="text-haidee-muted">
                {tLocal("thaiCost.dailyOverview.handlingCommission")}
              </p>
              <p className="font-mono">{money(section.handlingCommissionThb)} THB</p>
            </div>
            {isPattani && section.contractorThb != null && (
              <div>
                <p className="text-haidee-muted">
                  {tLocal("thaiCost.dailyOverview.contractorFee")}
                </p>
                <p className="font-mono">{money(section.contractorThb)} THB</p>
              </div>
            )}
            {isPattani && section.sakriCommissionThb != null && (
              <div>
                <p className="text-haidee-muted">
                  {tLocal("thaiCost.dailyOverview.sakriCommission")}
                </p>
                <p className="font-mono">
                  {money(section.sakriCommissionThb)} THB
                </p>
              </div>
            )}
            <div>
              <p className="text-haidee-muted">
                {tLocal("thaiCost.dailyOverview.driverTripCommission")}
              </p>
              <p className="font-mono">
                {money(section.driverTripCommissionThb)} THB
              </p>
            </div>
            <div>
              <p className="text-haidee-muted">
                {tLocal("thaiCost.dailyOverview.dailyAttendance")}
              </p>
              <p className="font-mono">{money(section.dailyLaborWageThb)} THB</p>
            </div>
            <div className="sm:col-span-3 rounded-md bg-haidee-surface/50 p-3">
              <p className="text-haidee-muted">
                {tLocal("thaiCost.dailyOverview.dayRealCost")}
              </p>
              <p className="font-mono text-lg font-semibold">
                {money(section.realCostTotalThb)} THB
              </p>
            </div>
          </div>

          {section.vehicleTrips.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">
                {tLocal("thaiCost.dailyOverview.vehicleDetail")}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tLocal("thaiCost.common.plate")}</TableHead>
                    <TableHead>{tLocal("thaiCost.common.driver")}</TableHead>
                    <TableHead className="text-right">
                      {tLocal("thaiCost.songkhlaHandling.colSizes")}
                    </TableHead>
                    <TableHead className="text-right">
                      {tLocal("thaiCost.dailyOverview.colIncome")}
                    </TableHead>
                    <TableHead className="text-right">
                      {tLocal("thaiCost.dailyOverview.colCost")}
                    </TableHead>
                    <TableHead className="text-right">
                      {tLocal("thaiCost.dailyOverview.colPnl")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.vehicleTrips.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono">{v.truckPlate}</TableCell>
                      <TableCell>
                        {v.driverName ?? "—"}
                        {v.isRented && (
                          <span className="ml-1 text-xs text-haidee-muted">
                            {tLocal("thaiCost.dailyOverview.rentedTag")}
                          </span>
                        )}
                        {v.needsReview && (
                          <span className="ml-1 text-xs text-amber-700">
                            needs_review
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {v.tongQty}/{v.boxQty}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {money(v.incomeThb)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {money(v.costThb)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${v.profitThb >= 0 ? "text-green-700" : "text-haidee-red"}`}
                      >
                        {money(v.profitThb)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-haidee-surface/30 font-medium">
                    <TableCell colSpan={3}>
                      {tLocal("thaiCost.dailyOverview.vehicleSubtotal")}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {money(section.vehiclePlTotals.incomeThb)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {money(section.vehiclePlTotals.costThb)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {money(section.vehiclePlTotals.profitThb)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          {section.driverTrips.length > 0 && (
            <div className="text-sm">
              <p className="font-medium">
                {tLocal("thaiCost.dailyOverview.driverTripsSection")}
              </p>
              <ul className="mt-1 space-y-0.5">
                {section.driverTrips.map((d) => (
                  <li key={d.driverName} className="flex justify-between font-mono">
                    <span>{d.driverName}</span>
                    <span>
                      {tLocal("thaiCost.dailyOverview.tripLine", {
                        count: String(d.tripCount),
                        amount: money(d.commissionThb),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
