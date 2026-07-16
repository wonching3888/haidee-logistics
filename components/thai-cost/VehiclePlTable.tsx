"use client";

import { useT } from "@/components/shared/locale-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { THAI_COST_STATION_LABELS } from "@/lib/constants/thai-cost";
import { formatDisplay } from "@/lib/date-utils";
import type { VehicleTripPlRow } from "@/lib/thai-cost/vehicle-pl";

function money(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export function VehiclePlTable({ rows }: { rows: VehicleTripPlRow[] }) {
  const { tLocal, locale } = useT();

  if (rows.length === 0) {
    return (
      <p className="text-sm text-haidee-muted">
        {tLocal("thaiCost.vehiclePl.noData")}
      </p>
    );
  }

  const totals = rows.reduce(
    (acc, r) => ({
      income: acc.income + r.incomeThb,
      cost: acc.cost + r.costThb,
      profit: acc.profit + r.profitThb,
    }),
    { income: 0, cost: 0, profit: 0 }
  );

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{tLocal("thaiCost.common.date")}</TableHead>
            <TableHead>{tLocal("thaiCost.common.plate")}</TableHead>
            <TableHead>{tLocal("thaiCost.common.driver")}</TableHead>
            <TableHead>{tLocal("thaiCost.common.station")}</TableHead>
            <TableHead className="text-right">
              {tLocal("thaiCost.common.crate")}/{tLocal("thaiCost.common.box")}
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
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-sm">{formatDisplay(r.date)}</TableCell>
              <TableCell className="font-mono">{r.truckPlate}</TableCell>
              <TableCell className="text-sm">
                {r.driverName ?? "—"}
                {r.needsReview && (
                  <span className="ml-1 text-xs text-amber-700">review</span>
                )}
              </TableCell>
              <TableCell>
                {THAI_COST_STATION_LABELS[r.station][locale]}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {r.tongQty}/{r.boxQty}
              </TableCell>
              <TableCell className="text-right font-mono">
                {money(r.incomeThb)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {money(r.costThb)}
              </TableCell>
              <TableCell
                className={`text-right font-mono ${r.profitThb >= 0 ? "text-green-700" : "text-haidee-red"}`}
              >
                {money(r.profitThb)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-haidee-surface/40 font-medium">
            <TableCell colSpan={5}>{tLocal("thaiCost.vehiclePl.total")}</TableCell>
            <TableCell className="text-right font-mono">
              {money(totals.income)}
            </TableCell>
            <TableCell className="text-right font-mono">
              {money(totals.cost)}
            </TableCell>
            <TableCell className="text-right font-mono">
              {money(totals.profit)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
