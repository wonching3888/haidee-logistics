import type { DailyDispatchSummaryData, DepotQty } from "@/app/actions/dashboard";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { STICKY_BODY_FIRST, STICKY_HEAD_FIRST } from "@/lib/table-scroll";
import { cn } from "@/lib/utils";
import "./daily-dispatch-summary.css";

interface DailyDispatchSummaryProps {
  data: DailyDispatchSummaryData;
}

function formatTong(qty: DepotQty): string {
  return qty.crate > 0 ? String(qty.crate) : "";
}

function formatBox(qty: DepotQty): string {
  return qty.box > 0 ? String(qty.box) : "";
}

function DepotCells({
  qty,
  bold = false,
}: {
  qty: DepotQty;
  bold?: boolean;
}) {
  const cellClass = `daily-summary-td daily-summary-col-qty font-mono${
    bold ? " font-bold" : ""
  }`;
  return (
    <>
      <td className={cellClass}>{formatTong(qty)}</td>
      <td className={cellClass}>{formatBox(qty)}</td>
    </>
  );
}

export function DailyDispatchSummary({ data }: DailyDispatchSummaryProps) {
  return (
    <ScrollMatrixTable
      heightOffset={400}
      className="daily-summary-print rounded-xl"
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
        <table
          className="daily-summary-table min-w-max border-collapse text-sm md:w-full"
          style={{ width: "100%" }}
        >
          <thead>
            <tr>
              <th
                rowSpan={2}
                className={cn(
                  "daily-summary-th daily-summary-col-lorry text-left",
                  STICKY_HEAD_FIRST
                )}
              >
                Lorry No
              </th>
              {data.activeDepots.map((depot) => (
                <th
                  key={depot}
                  colSpan={2}
                  className="daily-summary-th daily-summary-col-group sticky top-0 z-20 bg-[#c8e6c9]"
                >
                  {depot}
                </th>
              ))}
              <th
                colSpan={2}
                className="daily-summary-th daily-summary-col-group sticky top-0 z-20 bg-[#c8e6c9]"
              >
                Total
              </th>
            </tr>
            <tr>
              {data.activeDepots.flatMap((depot) => [
                <th
                  key={`${depot}-tong`}
                  className="daily-summary-th daily-summary-col-qty sticky top-[2.5rem] z-20 bg-[#c8e6c9]"
                >
                  Tong
                </th>,
                <th
                  key={`${depot}-box`}
                  className="daily-summary-th daily-summary-col-qty sticky top-[2.5rem] z-20 bg-[#c8e6c9]"
                >
                  Box
                </th>,
              ])}
              <th className="daily-summary-th daily-summary-col-qty sticky top-[2.5rem] z-20 bg-[#c8e6c9]">
                Tong
              </th>
              <th className="daily-summary-th daily-summary-col-qty sticky top-[2.5rem] z-20 bg-[#c8e6c9]">
                Box
              </th>
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
                <td
                  className={cn(
                    "daily-summary-td daily-summary-col-lorry font-mono font-medium text-left",
                    STICKY_BODY_FIRST,
                    index % 2 === 0 ? "bg-white" : "bg-[#f1f8f4]"
                  )}
                >
                  {row.lorryNo}
                </td>
                {data.activeDepots.map((depot) => (
                  <DepotCells
                    key={depot}
                    qty={row.depots[depot] ?? { crate: 0, box: 0 }}
                  />
                ))}
                <DepotCells qty={row.total} bold />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="daily-summary-total-row">
              <td
                className={cn(
                  "daily-summary-td daily-summary-col-lorry font-bold text-left",
                  STICKY_BODY_FIRST,
                  "bg-[#e8f5e9]"
                )}
              >
                Total
              </td>
              {data.activeDepots.map((depot) => (
                <DepotCells
                  key={depot}
                  qty={data.columnTotals[depot] ?? { crate: 0, box: 0 }}
                  bold
                />
              ))}
              <DepotCells qty={data.grandTotal} bold />
            </tr>
          </tfoot>
        </table>
      )}
    </ScrollMatrixTable>
  );
}
