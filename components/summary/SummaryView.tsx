"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { Printer } from "lucide-react";
import type { VehicleLoadingListData } from "@/app/actions/summary";
import { DateInputField } from "@/components/shared/DateInputField";
import { Button } from "@/components/ui/button";
import { cellDisplay } from "@/lib/consignor-label";
import { toDateInputValue } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface SummaryViewProps {
  date: string;
  displayDate: string;
  data: VehicleLoadingListData;
}

export function SummaryView({ date, displayDate, data }: SummaryViewProps) {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `loading-list-${date}`,
  });

  const colSpan = data.columns.length + 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">日期 Date</label>
          <DateInputField
            value={date}
            onChange={(next) => {
              const params = new URLSearchParams();
              params.set("date", next || toDateInputValue(new Date()));
              router.push(`/summary?${params.toString()}`);
            }}
          />
        </div>
        <Button
          onClick={handlePrint}
          disabled={!data.hasDispatches}
          className="gap-2 bg-haidee-blue text-white"
        >
          <Printer className="h-4 w-4" />
          打印装车清单 Print
        </Button>
      </div>

      <div
        ref={printRef}
        className="summary-print overflow-hidden rounded-xl border border-haidee-border bg-white"
      >
        <div className="hidden border-b border-haidee-border px-4 py-3 print:block">
          <h3 className="text-lg font-bold text-haidee-text">
            装车清单 Vehicle Loading List
          </h3>
          <p className="text-sm text-haidee-muted">{displayDate}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr>
                <th
                  rowSpan={3}
                  className="border border-haidee-border bg-haidee-surface px-3 py-2 text-left align-bottom font-medium text-haidee-muted"
                >
                  寄货人 / 地区
                  <br />
                  Consignor / Area
                </th>
                {data.trucks.map((truck) => (
                  <th
                    key={truck.orderId}
                    colSpan={truck.markets.length}
                    className="border border-haidee-border bg-haidee-surface px-2 py-2 text-center font-mono text-base font-bold text-haidee-text"
                  >
                    {truck.truckPlate}
                  </th>
                ))}
              </tr>
              <tr>
                {data.columns.map((col) => (
                  <th
                    key={`m-${col.key}`}
                    className="border border-haidee-border bg-haidee-surface px-2 py-1.5 text-center font-mono text-xs font-semibold text-haidee-text"
                  >
                    {col.marketCode}
                  </th>
                ))}
              </tr>
              <tr>
                {data.columns.map((col) => (
                  <th
                    key={`c-${col.key}`}
                    className="border border-haidee-border bg-haidee-surface px-2 py-1 text-center text-xs font-normal text-haidee-muted"
                  >
                    {col.showCapacity && col.capacity != null
                      ? `(${col.capacity}桶)`
                      : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!data.hasDispatches ? (
                <tr>
                  <td
                    colSpan={colSpan}
                    className="border border-haidee-border px-4 py-12 text-center text-haidee-muted"
                  >
                    今日尚未派车 No dispatch orders for this date
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr key={row.id}>
                    <td
                      className={cn(
                        "border border-haidee-border px-3 py-2 font-medium text-haidee-text",
                        row.indent && "pl-8"
                      )}
                    >
                      {row.label}
                    </td>
                    {data.columns.map((col) => {
                      const cell = row.cells[col.key];
                      const crateQty = cell?.crateQty ?? 0;
                      const boxQty = cell?.boxQty ?? 0;
                      return (
                        <td
                          key={col.key}
                          className="border border-haidee-border px-2 py-2 text-center font-mono"
                        >
                          {row.isGroupHeader
                            ? ""
                            : cellDisplay(crateQty, boxQty)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
            {data.hasDispatches && (
              <tfoot>
                <tr className="bg-haidee-navy/5 font-bold">
                  <td className="border border-haidee-border px-3 py-2 text-haidee-text">
                    各车总计 Truck Totals
                  </td>
                  {data.columns.map((col) => {
                    const total = data.columnCrateTotals[col.key] ?? 0;
                    return (
                      <td
                        key={col.key}
                        className="border border-haidee-border px-2 py-2 text-center font-mono"
                      >
                        {total > 0 ? total : ""}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 8mm;
          }
          .summary-print {
            font-size: 10px !important;
          }
          .summary-print table {
            font-size: 9px !important;
          }
        }
      `}</style>
    </div>
  );
}
