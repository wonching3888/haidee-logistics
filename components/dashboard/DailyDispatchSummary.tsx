"use client";

import { useRef, useState, useTransition } from "react";
import { useReactToPrint } from "react-to-print";
import { Printer, RefreshCw } from "lucide-react";
import {
  getDailyDispatchSummary,
  type DailyDispatchSummaryData,
  type DepotQty,
} from "@/app/actions/dashboard";
import { Button } from "@/components/ui/button";
import { cellDisplay } from "@/lib/consignor-label";
import "./daily-dispatch-summary.css";

interface DailyDispatchSummaryProps {
  initialData: DailyDispatchSummaryData;
}

function formatCell(qty: DepotQty): string {
  return cellDisplay(qty.crate, qty.box);
}

export function DailyDispatchSummary({ initialData }: DailyDispatchSummaryProps) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `daily-summary-${data.dateInput}`,
  });

  function handleGenerate() {
    startTransition(async () => {
      const fresh = await getDailyDispatchSummary(data.dateInput);
      setData(fresh);
    });
  }

  return (
    <section className="w-full space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-haidee-text">
          每日派车总结 Daily Summary
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePrint()}
            disabled={data.rows.length === 0}
            className="gap-1.5"
          >
            <Printer className="h-4 w-4" />
            打印 Print
          </Button>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={isPending}
            className="gap-1.5 bg-haidee-blue text-white hover:bg-haidee-blue/90"
          >
            <RefreshCw
              className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`}
            />
            {isPending ? "生成中…" : "生成 Generate"}
          </Button>
        </div>
      </div>

      <div
        ref={printRef}
        className="daily-summary-print overflow-hidden rounded-xl border border-haidee-border bg-white"
      >
        <div className="daily-summary-header px-4 py-3 text-center">
          <p className="text-base font-bold tracking-wide text-gray-900">
            WTL EXPRESS SDN BHD
          </p>
          <p className="mt-1 text-sm text-gray-700">
            Date: {data.date}
            <span className="mx-3">|</span>
            Daily Record
          </p>
        </div>

        {data.rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-haidee-muted">
            当日暂无派车数据 No dispatch data for this date
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="daily-summary-table w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="daily-summary-th text-left">Lorry No</th>
                  {data.activeDepots.map((depot) => (
                    <th key={depot} className="daily-summary-th">
                      {depot}
                    </th>
                  ))}
                  <th className="daily-summary-th">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, index) => (
                  <tr
                    key={row.lorryNo}
                    className={
                      index % 2 === 0
                        ? "daily-summary-row-even"
                        : "daily-summary-row-odd"
                    }
                  >
                    <td className="daily-summary-td font-mono font-medium">
                      {row.lorryNo}
                    </td>
                    {data.activeDepots.map((depot) => (
                      <td key={depot} className="daily-summary-td font-mono">
                        {formatCell(row.depots[depot] ?? { crate: 0, box: 0 })}
                      </td>
                    ))}
                    <td className="daily-summary-td font-mono font-semibold">
                      {formatCell(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="daily-summary-total-row">
                  <td className="daily-summary-td font-bold">Sum Total</td>
                  {data.activeDepots.map((depot) => (
                    <td
                      key={depot}
                      className="daily-summary-td font-mono font-bold"
                    >
                      {formatCell(
                        data.columnTotals[depot] ?? { crate: 0, box: 0 }
                      )}
                    </td>
                  ))}
                  <td className="daily-summary-td font-mono font-bold">
                    {formatCell(data.grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
