"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { VehicleTripPlRow } from "@/lib/thai-cost/vehicle-pl";

function money(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export function VehiclePlTable({ rows }: { rows: VehicleTripPlRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-haidee-muted">暂无车辆趟次盈亏数据</p>
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
            <TableHead>日期</TableHead>
            <TableHead>车牌</TableHead>
            <TableHead>司机</TableHead>
            <TableHead>据点</TableHead>
            <TableHead className="text-right">桶/盒</TableHead>
            <TableHead className="text-right">收入</TableHead>
            <TableHead className="text-right">成本</TableHead>
            <TableHead className="text-right">盈亏</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-sm">{r.date}</TableCell>
              <TableCell className="font-mono">{r.truckPlate}</TableCell>
              <TableCell className="text-sm">
                {r.driverName ?? "—"}
                {r.needsReview && (
                  <span className="ml-1 text-xs text-amber-700">review</span>
                )}
              </TableCell>
              <TableCell>{r.station === "SONGKHLA" ? "宋卡" : "北大年"}</TableCell>
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
            <TableCell colSpan={5}>合计</TableCell>
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
