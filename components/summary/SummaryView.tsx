"use client";

import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { Printer } from "lucide-react";
import type {
  LoadingMatrixColumn,
  VehicleLoadingListData,
} from "@/app/actions/summary";
import { DataFreshnessBar } from "@/components/shared/DataFreshnessBar";
import { DateInputField } from "@/components/shared/DateInputField";
import { Button } from "@/components/ui/button";
import { cellDisplay } from "@/lib/consignor-label";
import { MARKET_ORDER } from "@/lib/constants";
import { toDateInputValue } from "@/lib/date-utils";
import {
  getMatrixTableScrollStyle,
  STICKY_SUMMARY_BODY_LEFT,
  STICKY_SUMMARY_BODY_RIGHT,
  STICKY_SUMMARY_FOOTER_LEFT,
  STICKY_SUMMARY_FOOTER_RIGHT,
  STICKY_SUMMARY_HEAD_LEFT,
  STICKY_SUMMARY_HEAD_LEFT_ROW3,
  STICKY_SUMMARY_HEAD_MIDDLE,
  STICKY_SUMMARY_HEAD_MIDDLE_ROW3,
  STICKY_SUMMARY_HEAD_RIGHT,
  STICKY_SUMMARY_HEAD_RIGHT_ROW3,
  STICKY_SUMMARY_THEAD,
} from "@/lib/table-scroll";

interface SummaryViewProps {
  date: string;
  displayDate: string;
  data: VehicleLoadingListData;
}

const tableScrollStyle = getMatrixTableScrollStyle(220);

const marketColClass =
  "min-w-[2.75rem] w-[2.75rem] max-w-[2.75rem] px-1.5 text-center";
const consignorColClass =
  "w-[168px] min-w-[168px] max-w-[168px] align-top";
const subtotalColClass = "min-w-[72px] w-[72px] max-w-[72px]";

const foldConsignorHeadClass =
  "fold:py-1 fold:text-[10px] fold:leading-tight fold-land:py-1 fold-land:text-[10px] fold-land:leading-tight";
const foldTruckHeadClass =
  "fold:px-1 fold:py-0.5 fold:leading-none fold-land:px-1 fold-land:py-0.5 fold-land:leading-none";
const foldSubtotalHeadClass =
  "fold:px-1 fold:py-1 fold:text-[10px] fold:leading-tight fold-land:px-1 fold-land:py-1 fold-land:text-[10px] fold-land:leading-tight";
const foldMarketHeadClass =
  "fold:py-0.5 fold:text-[10px] fold:leading-none fold-land:py-0.5 fold-land:text-[10px] fold-land:leading-none";
const foldColumnQtyHeadClass =
  "fold:py-0.5 fold:text-[10px] fold:leading-none fold-land:py-0.5 fold-land:text-[10px] fold-land:leading-none";
const foldHeadPlaceholderClass = "fold:py-0.5 fold-land:py-0.5";

function sumCellsAcrossColumns(
  columns: LoadingMatrixColumn[],
  cells: Record<string, { crateQty: number; boxQty: number }>
): { crateQty: number; boxQty: number } {
  let crateQty = 0;
  let boxQty = 0;
  for (const col of columns) {
    const cell = cells[col.key];
    if (!cell) continue;
    crateQty += cell.crateQty;
    boxQty += cell.boxQty;
  }
  return { crateQty, boxQty };
}

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

  const grandTotal = useMemo(() => {
    let crateQty = 0;
    let boxQty = 0;
    for (const sub of Object.values(columnSubtotals)) {
      crateQty += sub.crateQty;
      boxQty += sub.boxQty;
    }
    return { crateQty, boxQty };
  }, [columnSubtotals]);

  function truckTotalLabel(crateQty: number, boxQty: number): string {
    if (crateQty === 0 && boxQty === 0) return "";
    return `(${cellDisplay(crateQty, boxQty)})`;
  }

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `loading-list-${date}`,
  });

  const colSpan = columns.length + 2;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-2 max-md:gap-1.5 md:gap-3">
      <div className="flex shrink-0 flex-col gap-1.5 max-md:gap-1 md:flex-row md:flex-wrap md:items-end md:gap-3">
        <div className="max-md:w-full max-md:space-y-0.5">
          <label className="text-xs font-medium max-md:text-[11px] md:text-sm">
            日期 Date
          </label>
          <DateInputField
            value={date}
            onChange={(next) => {
              const params = new URLSearchParams();
              params.set("date", next || toDateInputValue(new Date()));
              router.push(`/summary?${params.toString()}`);
            }}
          />
        </div>
      </div>

      <DataFreshnessBar
        scope="daily-ops"
        params={{ date }}
        onRefresh={() => router.refresh()}
        className="max-md:px-2 max-md:py-1"
      />

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
            <thead className={STICKY_SUMMARY_THEAD}>
              <tr>
                <th
                  className={`${STICKY_SUMMARY_HEAD_LEFT} ${consignorColClass} ${foldConsignorHeadClass} px-3 py-2 text-left font-medium text-haidee-muted`}
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
                      className={`${STICKY_SUMMARY_HEAD_MIDDLE} ${foldTruckHeadClass} px-2 py-2 text-center font-mono text-base font-bold text-haidee-text`}
                    >
                      <div className="flex flex-col items-center fold:flex-row fold:items-baseline fold:justify-center fold:gap-x-1 fold:whitespace-nowrap fold:leading-none fold-land:flex-row fold-land:items-baseline fold-land:justify-center fold-land:gap-x-1 fold-land:whitespace-nowrap fold-land:leading-none">
                        <span className="fold:text-xs fold-land:text-xs">
                          {truck.truckPlate}
                        </span>
                        {totalLabel ? (
                          <span className="mt-0.5 text-xs font-normal text-haidee-muted fold:mt-0 fold:text-[10px] fold:leading-none fold-land:mt-0 fold-land:text-[10px] fold-land:leading-none">
                            {totalLabel}
                          </span>
                        ) : null}
                      </div>
                    </th>
                  );
                })}
                <th
                  className={`${STICKY_SUMMARY_HEAD_RIGHT} ${subtotalColClass} ${foldSubtotalHeadClass} px-2 py-2 text-center align-middle font-medium text-haidee-muted`}
                >
                  小计
                  <br />
                  Subtotal
                </th>
              </tr>
              <tr>
                <th
                  aria-hidden="true"
                  className={`${STICKY_SUMMARY_HEAD_LEFT} ${consignorColClass} ${foldHeadPlaceholderClass} py-1.5`}
                />
                {columns.map((col) => (
                  <th
                    key={`m-${col.key}`}
                    className={`${STICKY_SUMMARY_HEAD_MIDDLE} ${marketColClass} ${foldMarketHeadClass} py-1.5 font-mono text-xs font-semibold text-haidee-text`}
                  >
                    {col.marketCode}
                  </th>
                ))}
                <th
                  aria-hidden="true"
                  className={`${STICKY_SUMMARY_HEAD_RIGHT} ${subtotalColClass} ${foldHeadPlaceholderClass} py-1.5`}
                />
              </tr>
              <tr>
                <th
                  aria-hidden="true"
                  className={`${STICKY_SUMMARY_HEAD_LEFT_ROW3} ${consignorColClass} ${foldHeadPlaceholderClass} py-1`}
                />
                {columns.map((col) => {
                  const subtotal = columnSubtotals[col.key];
                  return (
                    <th
                      key={`sub-${col.key}`}
                      className={`${STICKY_SUMMARY_HEAD_MIDDLE_ROW3} ${marketColClass} ${foldColumnQtyHeadClass} py-1 font-mono text-[11px] font-semibold text-haidee-muted`}
                    >
                      {cellDisplay(subtotal.crateQty, subtotal.boxQty)}
                    </th>
                  );
                })}
                <th
                  aria-hidden="true"
                  className={`${STICKY_SUMMARY_HEAD_RIGHT_ROW3} ${subtotalColClass} ${foldHeadPlaceholderClass} py-1`}
                />
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
                data.rows.map((row) => {
                  const rowTotal = sumCellsAcrossColumns(columns, row.cells);
                  return (
                    <tr key={row.id}>
                      <td
                        className={`px-3 py-2 font-medium text-haidee-text ${consignorColClass} ${STICKY_SUMMARY_BODY_LEFT}`}
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
                            className={`border border-haidee-border py-2 font-mono ${marketColClass}`}
                          >
                            {cellDisplay(crateQty, boxQty)}
                          </td>
                        );
                      })}
                      <td
                        className={`px-2 py-2 text-center font-mono font-semibold ${subtotalColClass} ${STICKY_SUMMARY_BODY_RIGHT}`}
                      >
                        {cellDisplay(rowTotal.crateQty, rowTotal.boxQty)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {data.hasDispatches && (
              <tfoot>
                <tr className="bg-haidee-navy/5 font-bold">
                  <td
                    className={`px-3 py-2 text-haidee-text ${consignorColClass} ${STICKY_SUMMARY_FOOTER_LEFT}`}
                  >
                    总计 Total
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`border border-haidee-border py-2 font-mono ${marketColClass}`}
                    />
                  ))}
                  <td
                    className={`px-2 py-2 text-center font-mono font-bold ${subtotalColClass} ${STICKY_SUMMARY_FOOTER_RIGHT}`}
                  >
                    {cellDisplay(grandTotal.crateQty, grandTotal.boxQty)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <Button
        onClick={handlePrint}
        disabled={!data.hasDispatches}
        className="shrink-0 gap-2 bg-haidee-blue text-white max-md:min-h-[44px] max-md:w-full md:w-auto md:self-start"
      >
        <Printer className="h-4 w-4" />
        打印装车清单 Print
      </Button>

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
