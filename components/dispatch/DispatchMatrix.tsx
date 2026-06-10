"use client";

import { getMarketColor } from "@/lib/markets";
import type { DispatchMatrixData } from "@/app/actions/dispatch";
import { cn } from "@/lib/utils";

interface DispatchMatrixProps {
  data: DispatchMatrixData;
}

export function DispatchMatrix({ data }: DispatchMatrixProps) {
  const { shippers, markets, cells, rowTotals, colTotals, grandTotal } = data;

  if (shippers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-haidee-border bg-white p-12 text-center text-haidee-muted">
        暂无未分配货物 No unassigned cargo
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-haidee-border bg-haidee-surface">
              <th className="sticky left-0 z-10 bg-haidee-surface px-3 py-3 text-left font-medium text-haidee-muted">
                寄货人 / 地区 Consignor / Area
              </th>
              {markets.map((code) => {
                const c = getMarketColor(code);
                return (
                  <th
                    key={code}
                    className="min-w-[52px] px-2 py-3 text-center font-mono text-xs font-semibold"
                    style={{
                      backgroundColor: c.bg,
                      color: c.text,
                      borderBottom: `2px solid ${c.border}`,
                    }}
                  >
                    {code}
                  </th>
                );
              })}
              <th className="px-3 py-3 text-right font-medium text-haidee-muted">
                合计 Total
              </th>
            </tr>
          </thead>
          <tbody>
            {shippers.map((shipper) => (
              <tr
                key={shipper.id}
                className="border-b border-haidee-border/60 hover:bg-haidee-surface/50"
              >
                <td className="sticky left-0 z-10 bg-white px-3 py-2.5 font-medium text-haidee-text">
                  {shipper.name}
                </td>
                {markets.map((code) => {
                  const qty = cells[shipper.id]?.[code] ?? 0;
                  return (
                    <td
                      key={code}
                      className={cn(
                        "px-2 py-2.5 text-center font-mono text-sm text-gray-800",
                        qty > 0 && "font-semibold"
                      )}
                    >
                      {qty > 0 ? qty : ""}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-right font-mono font-bold text-haidee-text">
                  {rowTotals[shipper.id] ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-haidee-navy bg-haidee-navy/5 font-semibold">
              <td className="sticky left-0 z-10 bg-haidee-surface px-3 py-3 text-haidee-text">
                各市场总计 Market Totals
              </td>
              {markets.map((code) => (
                <td
                  key={code}
                  className="px-2 py-3 text-center font-mono text-haidee-text"
                >
                  {colTotals[code] ?? 0}
                </td>
              ))}
              <td className="px-3 py-3 text-right font-mono text-lg text-haidee-navy">
                {grandTotal}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
