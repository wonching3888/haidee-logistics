"use client";

import type { DispatchMatrixData } from "@/app/actions/dispatch";
import { DispatchMarketLabel } from "@/components/dispatch/DispatchMarketLabel";
import { MobileTruncatedName } from "@/components/shared/MobileTruncatedName";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { STICKY_BODY_FIRST, STICKY_HEAD_FIRST, STICKY_HEAD_TOP } from "@/lib/table-scroll";
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

/** Height of the market-label header row — row 2 sticks directly beneath it. */
const MARKET_HEADER_ROW_TOP = "4rem";

export function DispatchMatrix({ data }: DispatchMatrixProps) {
  const { shippers, markets, cells, rowTotals, colTotals, grandTotal } = data;
  const colSpan = markets.length + 2;

  return (
    <ScrollMatrixTable heightOffset={280}>
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-haidee-border bg-haidee-surface">
              <th className={cn(STICKY_HEAD_FIRST, "whitespace-nowrap px-3 py-3 text-left font-medium text-haidee-muted")}>
                寄货人 / 地区 Consignor / Area
              </th>
              {markets.map((code) => (
                <th
                  key={code}
                  className={cn(STICKY_HEAD_TOP, "min-w-[56px] whitespace-nowrap px-2 py-3 text-center")}
                >
                  <div className="flex justify-center">
                    <DispatchMarketLabel code={code} className="font-mono" showDisplayName />
                  </div>
                </th>
              ))}
              <th className={cn(STICKY_HEAD_TOP, "whitespace-nowrap px-3 py-3 text-right font-medium text-haidee-muted")}>
                合计 Total
              </th>
            </tr>
            <tr className="border-b-2 border-haidee-border bg-gray-100 font-semibold">
              <th
                className={cn(STICKY_BODY_FIRST, "z-40 whitespace-nowrap bg-gray-100 px-3 py-2.5 text-left text-haidee-text")}
                style={{ top: MARKET_HEADER_ROW_TOP }}
              >
                各市场总计 Market Totals
              </th>
              {markets.map((code) => {
                const qty = colTotals[code] ?? emptyQty();
                return (
                  <th
                    key={code}
                    className={cn(STICKY_HEAD_TOP, "z-20 min-w-[56px] whitespace-nowrap bg-gray-100 px-2 py-2.5 text-center font-mono text-haidee-text")}
                    style={{ top: MARKET_HEADER_ROW_TOP }}
                  >
                    <TotalsCellDisplay crate={qty.crate} box={qty.box} />
                  </th>
                );
              })}
              <th
                className={cn(STICKY_HEAD_TOP, "z-20 whitespace-nowrap bg-gray-100 px-3 py-2.5 text-right font-mono text-lg text-haidee-navy")}
                style={{ top: MARKET_HEADER_ROW_TOP }}
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
            {shippers.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-3 py-10 text-center text-haidee-muted"
                >
                  暂无未分配货物 No unassigned cargo
                </td>
              </tr>
            ) : (
              shippers.map((shipper) => {
                const row = rowTotals[shipper.id] ?? emptyQty();
                const rowLabel = cellDisplay(row.crate, row.box);
                return (
                  <tr
                    key={shipper.id}
                    className="border-b border-haidee-border/60 hover:bg-haidee-surface/50"
                  >
                    <td className={cn(STICKY_BODY_FIRST, "max-md:whitespace-normal px-3 py-2.5 font-medium text-haidee-text md:whitespace-nowrap")}>
                      <MobileTruncatedName text={shipper.name} />
                    </td>
                    {markets.map((code) => {
                      const qty = cells[shipper.id]?.[code] ?? emptyQty();
                      const label = cellDisplay(qty.crate, qty.box);
                      return (
                        <td
                          key={code}
                          className={cn(
                            "whitespace-nowrap px-2 py-2.5 text-center font-mono text-sm text-gray-800",
                            label && "font-semibold"
                          )}
                        >
                          {label}
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-bold text-haidee-text">
                      {rowLabel}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
    </ScrollMatrixTable>
  );
}
