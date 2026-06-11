"use client";

import type { DispatchMatrixData } from "@/app/actions/dispatch";
import { DispatchMarketLabel } from "@/components/dispatch/DispatchMarketLabel";
import { cellDisplay } from "@/lib/consignor-label";
import { cn } from "@/lib/utils";

interface DispatchMatrixProps {
  data: DispatchMatrixData;
}

function emptyQty() {
  return { crate: 0, box: 0 };
}

function TotalsCellDisplay({
  crate,
  box,
  align = "center",
}: {
  crate: number;
  box: number;
  align?: "center" | "end";
}) {
  if (crate === 0 && box === 0) return null;
  if (crate === 0) return <>{box}盒</>;
  if (box === 0) return <>{crate}</>;
  return (
    <div
      className={cn(
        "flex flex-col leading-tight",
        align === "end" ? "items-end" : "items-center"
      )}
    >
      <span>{crate}</span>
      <span className="text-xs font-normal">{box}盒</span>
    </div>
  );
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

  const headerRowHeight = "3.5rem";

  return (
    <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-haidee-border bg-haidee-surface">
              <th className="sticky left-0 top-0 z-30 bg-haidee-surface px-3 py-3 text-left font-medium text-haidee-muted">
                寄货人 / 地区 Consignor / Area
              </th>
              {markets.map((code) => (
                <th
                  key={code}
                  className="sticky top-0 z-20 min-w-[52px] bg-haidee-surface px-2 py-3 text-center"
                >
                  <DispatchMarketLabel code={code} className="font-mono" />
                </th>
              ))}
              <th className="sticky top-0 z-20 bg-haidee-surface px-3 py-3 text-right font-medium text-haidee-muted">
                合计 Total
              </th>
            </tr>
            <tr className="border-b-2 border-haidee-border bg-gray-100 font-semibold">
              <th
                className="sticky left-0 z-40 bg-gray-100 px-3 py-2.5 text-left text-haidee-text"
                style={{ top: headerRowHeight }}
              >
                各市场总计 Market Totals
              </th>
              {markets.map((code) => {
                const qty = colTotals[code] ?? emptyQty();
                return (
                  <th
                    key={code}
                    className="sticky z-20 min-w-[52px] bg-gray-100 px-2 py-2.5 text-center font-mono text-haidee-text"
                    style={{ top: headerRowHeight }}
                  >
                    <TotalsCellDisplay crate={qty.crate} box={qty.box} />
                  </th>
                );
              })}
              <th
                className="sticky z-20 bg-gray-100 px-3 py-2.5 text-right font-mono text-lg text-haidee-navy"
                style={{ top: headerRowHeight }}
              >
                <TotalsCellDisplay
                  crate={grandTotal.crate}
                  box={grandTotal.box}
                  align="end"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {shippers.map((shipper) => {
              const row = rowTotals[shipper.id] ?? emptyQty();
              const rowLabel = cellDisplay(row.crate, row.box);
              return (
                <tr
                  key={shipper.id}
                  className="border-b border-haidee-border/60 hover:bg-haidee-surface/50"
                >
                  <td className="sticky left-0 z-10 bg-white px-3 py-2.5 font-medium text-haidee-text">
                    {shipper.name}
                  </td>
                  {markets.map((code) => {
                    const qty = cells[shipper.id]?.[code] ?? emptyQty();
                    const label = cellDisplay(qty.crate, qty.box);
                    return (
                      <td
                        key={code}
                        className={cn(
                          "px-2 py-2.5 text-center font-mono text-sm text-gray-800",
                          label && "font-semibold"
                        )}
                      >
                        {label}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-haidee-text">
                    {rowLabel}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
