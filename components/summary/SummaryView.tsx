"use client";

import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { Printer } from "lucide-react";
import type {
  LoadingMatrixColumn,
  VehicleLoadingListData,
} from "@/app/actions/summary";
import { DateInputField } from "@/components/shared/DateInputField";
import { Button } from "@/components/ui/button";
import { cellDisplay } from "@/lib/consignor-label";
import { MARKET_ORDER } from "@/lib/constants";
import { getMarketDisplayName } from "@/lib/constants/market-names";
import { toDateInputValue } from "@/lib/date-utils";
import { getMatrixTableScrollStyle } from "@/lib/table-scroll";

interface SummaryViewProps {
  date: string;
  displayDate: string;
  data: VehicleLoadingListData;
}

const tableScrollStyle = getMatrixTableScrollStyle(220);

const stickyHeadRow1 =
  "sticky top-0 z-20 border border-haidee-border bg-haidee-surface";
const stickyHeadRow2 =
  "sticky top-[3.25rem] z-20 border border-haidee-border bg-haidee-surface";
const stickyHeadRow3 =
  "sticky top-[5.25rem] z-20 border border-haidee-border bg-gray-50";
const stickyHeadCorner =
  "sticky left-0 top-0 z-30 border border-haidee-border bg-haidee-surface";
const consignorColClass =
  "w-[168px] min-w-[168px] max-w-[168px] align-top";
const stickyFirstColBody =
  "sticky left-0 z-10 border border-haidee-border bg-white";
const stickyFirstColFooter =
  "sticky left-0 z-10 border border-haidee-border bg-haidee-navy/5";

function sortColumnsByMarketOrder(
  columns: LoadingMatrixColumn[],
  trucks: VehicleLoadingListData["trucks"]
): LoadingMatrixColumn[] {
  const truckOrder = new Map(trucks.map((truck, index) => [truck.orderId, index]));
  const marketOrder = new Map<string, number>(
    MARKET_ORDER.map((code, index) => [code, index])
  );

  return [...columns].sort((a, b) => {
    const truckCmp =
      (truckOrder.get(a.orderId) ?? 999) - (truckOrder.get(b.orderId) ?? 999);
    if (truckCmp !== 0) return truckCmp;
    return (
      (marketOrder.get(a.marketCode) ?? 999) -
      (marketOrder.get(b.marketCode) ?? 999)
    );
  });
}

export function SummaryView({ date, displayDate, data }: SummaryViewProps) {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(
    () => sortColumnsByMarketOrder(data.columns, data.trucks),
    [data.columns, data.trucks]
  );

  const columnSubtotals = useMemo(() => {
    const totals: Record<string, { crateQty: number; boxQty: number }> = {};
    for (const col of columns) {
      totals[col.key] = { crateQty: 0, boxQty: 0 };
    }
    for (const row of data.rows) {
      for (const col of columns) {
        const cell = row.cells[col.key];
        if (!cell) continue;
        totals[col.key].crateQty += cell.crateQty;
        totals[col.key].boxQty += cell.boxQty;
      }
    }
    return totals;
  }, [columns, data.rows]);

  const truckTotals = useMemo(() => {
    const totals: Record<string, { crateQty: number; boxQty: number }> = {};
    for (const truck of data.trucks) {
      totals[truck.orderId] = { crateQty: 0, boxQty: 0 };
    }
    for (const col of columns) {
      const sub = columnSubtotals[col.key];
      const truckTotal = totals[col.orderId];
      if (!truckTotal || !sub) continue;
      truckTotal.crateQty += sub.crateQty;
      truckTotal.boxQty += sub.boxQty;
    }
    return totals;
  }, [columns, columnSubtotals, data.trucks]);

  function truckTotalLabel(crateQty: number, boxQty: number): string {
    if (crateQty === 0 && boxQty === 0) return "";
    return `(${cellDisplay(crateQty, boxQty)})`;
  }

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `loading-list-${date}`,
  });

  const colSpan = columns.length + 1;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-3 max-md:items-stretch md:flex-row md:flex-wrap md:items-end md:gap-4">
        <div className="space-y-1 max-md:w-full">
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
          className="gap-2 bg-haidee-blue text-white max-md:min-h-[44px] max-md:w-full md:w-auto"
        >
          <Printer className="h-4 w-4" />
          打印装车清单 Print
        </Button>
      </div>

      <div
        ref={printRef}
        className="summary-print flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-haidee-border bg-white"
      >
        <div className="hidden border-b border-haidee-border px-4 py-3 print:block">
          <h3 className="text-lg font-bold text-haidee-text">
            装车清单 Vehicle Loading List
          </h3>
          <p className="text-sm text-haidee-muted">{displayDate}</p>
        </div>

        <div
          data-summary-table-scroll
          className="summary-table-scroll min-h-0 min-w-0 flex-1"
          style={tableScrollStyle}
        >
          <table
            style={{ minWidth: "max-content" }}
            className="border-collapse text-sm"
          >
            <thead>
              <tr>
                <th
                  rowSpan={3}
                  className={`${stickyHeadCorner} ${consignorColClass} px-3 py-2 text-left align-bottom font-medium text-haidee-muted`}
                >
                  寄货人 / 地区
                  <br />
                  Consignor / Area
                </th>
                {data.trucks.map((truck) => {
                  const total = truckTotals[truck.orderId];
                  const totalLabel = total
                    ? truckTotalLabel(total.crateQty, total.boxQty)
                    : "";
                  return (
                    <th
                      key={truck.orderId}
                      colSpan={truck.markets.length}
                      className={`${stickyHeadRow1} px-2 py-2 text-center font-mono text-base font-bold text-haidee-text`}
                    >
                      <div>{truck.truckPlate}</div>
                      {totalLabel && (
                        <div className="mt-0.5 text-xs font-normal text-haidee-muted">
                          {totalLabel}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
              <tr>
                {columns.map((col) => (
                  <th
                    key={`m-${col.key}`}
                    className={`${stickyHeadRow2} px-2 py-1.5 text-center font-mono text-xs font-semibold text-haidee-text`}
                  >
                    {col.marketCode}
                    <span className="mt-0.5 block text-[10px] font-bold leading-tight text-haidee-text">
                      {getMarketDisplayName(col.marketCode)}
                    </span>
                  </th>
                ))}
              </tr>
              <tr>
                {columns.map((col) => {
                  const subtotal = columnSubtotals[col.key];
                  return (
                    <th
                      key={`sub-${col.key}`}
                      className={`${stickyHeadRow3} px-2 py-1 text-center font-mono text-[11px] font-semibold text-haidee-muted`}
                    >
                      {cellDisplay(subtotal.crateQty, subtotal.boxQty)}
                    </th>
                  );
                })}
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
                      className={`px-3 py-2 font-medium text-haidee-text ${consignorColClass} ${stickyFirstColBody}`}
                    >
                      <LoadingListConsignorCell
                        displayName={row.displayName}
                        fullLabel={row.label}
                      />
                    </td>
                    {columns.map((col) => {
                      const cell = row.cells[col.key];
                      const crateQty = cell?.crateQty ?? 0;
                      const boxQty = cell?.boxQty ?? 0;
                      return (
                        <td
                          key={col.key}
                          className="border border-haidee-border px-2 py-2 text-center font-mono"
                        >
                          {cellDisplay(crateQty, boxQty)}
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
                  <td
                    className={`px-3 py-2 text-haidee-text ${consignorColClass} ${stickyFirstColFooter}`}
                  >
                    各车总计 Truck Totals
                  </td>
                  {columns.map((col) => {
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
            size: A4 portrait;
            margin: 8mm;
          }
          .summary-print {
            font-size: 10pt !important;
            color: #000000 !important;
            font-weight: 700 !important;
          }
          .summary-print table {
            font-size: 10pt !important;
          }
          .summary-print th {
            color: #000000 !important;
            font-weight: 700 !important;
            background: #a8a8a8 !important;
          }
          .summary-print td {
            color: #000000 !important;
            font-weight: 700 !important;
          }
          .summary-print .font-mono {
            font-size: 10pt !important;
            font-variant-numeric: tabular-nums;
            font-weight: 700 !important;
          }
          .summary-print .text-haidee-text,
          .summary-print .text-haidee-muted {
            color: #000000 !important;
            font-weight: 700 !important;
          }
          .summary-table-scroll {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .summary-print .consignor-cell-screen {
            display: none !important;
          }
          .summary-print .consignor-cell-print {
            display: block !important;
            max-width: none !important;
            white-space: normal !important;
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  );
}

function LoadingListConsignorCell({
  displayName,
  fullLabel,
}: {
  displayName: string;
  fullLabel: string;
}) {
  return (
    <>
      <span
        className="consignor-cell-screen block truncate"
        title={fullLabel}
      >
        {displayName}
      </span>
      <span className="consignor-cell-print hidden whitespace-normal print:block">
        {fullLabel}
      </span>
    </>
  );
}
