"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { Printer } from "lucide-react";
import type { VehicleLoadingListData } from "@/app/actions/summary";
import { DateInputField } from "@/components/shared/DateInputField";
import { Button } from "@/components/ui/button";
import { toDateInputValue } from "@/lib/date-utils";

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
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-haidee-border bg-haidee-surface px-3 py-3 text-left font-medium text-haidee-muted">
                  寄货人 / 地区 Consignor / Area
                </th>
                {data.columns.map((col) => (
                  <th
                    key={col.id}
                    className="border border-haidee-border bg-haidee-surface px-2 py-3 text-center"
                  >
                    <div className="font-mono text-base font-bold text-haidee-text">
                      {col.truckPlate}
                    </div>
                    {col.capacity != null && (
                      <div className="text-xs font-normal text-haidee-muted">
                        ({col.capacity} 桶)
                      </div>
                    )}
                  </th>
                ))}
                <th className="border border-haidee-border bg-haidee-surface px-2 py-3 text-center font-medium">
                  BOX
                </th>
                <th className="border border-haidee-border bg-haidee-surface px-3 py-3 text-right font-medium">
                  合计 Total
                </th>
              </tr>
            </thead>
            <tbody>
              {!data.hasDispatches ? (
                <tr>
                  <td
                    colSpan={data.columns.length + 3}
                    className="border border-haidee-border px-4 py-12 text-center text-haidee-muted"
                  >
                    今日尚未派车 No dispatch orders for this date
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr key={row.sessionId}>
                    <td className="border border-haidee-border px-3 py-2 font-medium">
                      {row.label}
                    </td>
                    {data.columns.map((col) => {
                      const qty = row.cells[col.id] ?? 0;
                      return (
                        <td
                          key={col.id}
                          className="border border-haidee-border px-2 py-2 text-center font-mono"
                        >
                          {qty > 0 ? qty : ""}
                        </td>
                      );
                    })}
                    <td className="border border-haidee-border px-2 py-2 text-center font-mono">
                      {row.boxTotal > 0 ? `${row.boxTotal}盒` : ""}
                    </td>
                    <td className="border border-haidee-border px-3 py-2 text-right font-mono font-semibold">
                      {row.total}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data.hasDispatches && (
              <tfoot>
                <tr className="bg-haidee-navy/5 font-bold">
                  <td className="border border-haidee-border px-3 py-2">
                    各车总计 Truck Totals
                  </td>
                  {data.columns.map((col) => (
                    <td
                      key={col.id}
                      className="border border-haidee-border px-2 py-2 text-center font-mono"
                    >
                      {data.columnTotals[col.id] ?? ""}
                    </td>
                  ))}
                  <td className="border border-haidee-border px-2 py-2 text-center font-mono">
                    {data.boxGrandTotal > 0 ? `${data.boxGrandTotal}盒` : ""}
                  </td>
                  <td className="border border-haidee-border px-3 py-2 text-right font-mono">
                    {data.grandTotal}
                  </td>
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
