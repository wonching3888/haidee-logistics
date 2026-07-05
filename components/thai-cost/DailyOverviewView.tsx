"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          日期
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
          打开当日 Sadao Voucher
        </Link>
      </div>

      {/* ① Sadao */}
      <section className="space-y-3 rounded-lg border border-haidee-border p-4">
        <h3 className="text-lg font-semibold">① Sadao 搬运</h3>
        <p className="text-xs text-haidee-muted">
          计入公司主运费成本，不在此单独衡量盈亏。
        </p>
        {overview.sadao ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="text-sm">
              <p className="text-haidee-muted">计费桶数</p>
              <p className="font-mono">
                小 {overview.sadao.billableSmall} / 大{" "}
                {overview.sadao.billableLarge} / 盒 {overview.sadao.billableBox}
              </p>
              <p className="mt-1 text-xs">
                {overview.sadao.holidayRate ? "假日费率" : "平日费率"}
              </p>
            </div>
            <div className="text-sm">
              <p className="text-haidee-muted">当日提成</p>
              <p className="font-mono text-lg font-semibold">
                {money(overview.sadao.commissionThb)} THB
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-haidee-muted">当日无 Sadao 搬运记录</p>
        )}
      </section>

      {/* ② Songkhla */}
      <StationSection
        title="② 宋卡据点 — 独立核算"
        section={overview.songkhla}
        isPattani={false}
      />

      {/* ③ Pattani */}
      <StationSection
        title="③ 北大年据点 — 独立核算"
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
  return (
    <section className="space-y-4 rounded-lg border border-haidee-border p-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      {!section ? (
        <p className="text-sm text-haidee-muted">当日无该据点记录</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <p className="text-haidee-muted">搬运提成</p>
              <p className="font-mono">{money(section.handlingCommissionThb)} THB</p>
            </div>
            {isPattani && section.contractorThb != null && (
              <div>
                <p className="text-haidee-muted">外包费用</p>
                <p className="font-mono">{money(section.contractorThb)} THB</p>
              </div>
            )}
            {isPattani && section.sakriCommissionThb != null && (
              <div>
                <p className="text-haidee-muted">SAKRI 提成</p>
                <p className="font-mono">
                  {money(section.sakriCommissionThb)} THB
                </p>
              </div>
            )}
            <div>
              <p className="text-haidee-muted">司机趟次提成</p>
              <p className="font-mono">
                {money(section.driverTripCommissionThb)} THB
              </p>
            </div>
            <div>
              <p className="text-haidee-muted">日薪出勤</p>
              <p className="font-mono">{money(section.dailyLaborWageThb)} THB</p>
            </div>
            <div className="sm:col-span-3 rounded-md bg-haidee-surface/50 p-3">
              <p className="text-haidee-muted">当日真实成本合计</p>
              <p className="font-mono text-lg font-semibold">
                {money(section.realCostTotalThb)} THB
              </p>
            </div>
          </div>

          {section.vehicleTrips.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">车辆明细</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>车牌</TableHead>
                    <TableHead>司机</TableHead>
                    <TableHead className="text-right">桶/盒</TableHead>
                    <TableHead className="text-right">收入</TableHead>
                    <TableHead className="text-right">成本</TableHead>
                    <TableHead className="text-right">盈亏</TableHead>
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
                            (租车)
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
                    <TableCell colSpan={3}>车辆小计</TableCell>
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
              <p className="font-medium">司机趟次</p>
              <ul className="mt-1 space-y-0.5">
                {section.driverTrips.map((d) => (
                  <li key={d.driverName} className="flex justify-between font-mono">
                    <span>{d.driverName}</span>
                    <span>
                      {d.tripCount} 趟 · {money(d.commissionThb)} THB
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
