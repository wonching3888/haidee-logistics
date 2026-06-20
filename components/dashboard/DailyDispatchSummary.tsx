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
  const cellClass = cn(
    "daily-summary-td daily-summary-col-qty font-mono",
    bold && "font-semibold"
  );
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
      className="daily-summary-print shadow-sm"
    >
      <div className="daily-summary-header flex items-center justify-center gap-3 px-5 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          width={36}
          height={36}
          alt="WTL Logo"
          className="shrink-0"
          style={{ mixBlendMode: "multiply" }}
        />
        <div className="text-center">
          <p className="text-base font-bold tracking-wide text-haidee-text">
            WTL EXPRESS SDN BHD
          </p>
          <p className="mt-0.5 text-sm text-haidee-muted">
            Date: {data.date}
            <span className="mx-2 text-haidee-border">|</span>
            Daily Record
          </p>
        </div>
      </div>

      {data.rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-haidee-muted">
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
                  "daily-summary-th daily-summary-col-lorry",
                  STICKY_HEAD_FIRST
                )}
              >
                Lorry No
              </th>
              {data.activeDepots.map((depot) => (
                <th
                  key={depot}
                  colSpan={2}
                  className="daily-summary-th daily-summary-col-group sticky top-0 z-20 bg-haidee-surface"
                >
                  {depot}
                </th>
              ))}
              <th
                colSpan={2}
                className="daily-summary-th daily-summary-col-group sticky top-0 z-20 bg-haidee-surface"
              >
                Total
              </th>
            </tr>
            <tr>
              {data.activeDepots.flatMap((depot) => [
                <th
                  key={`${depot}-tong`}
                  className="daily-summary-th daily-summary-col-qty sticky top-[2.35rem] z-20 bg-haidee-surface"
                >
                  Tong
                </th>,
                <th
                  key={`${depot}-box`}
                  className="daily-summary-th daily-summary-col-qty sticky top-[2.35rem] z-20 bg-haidee-surface"
                >
                  Box
                </th>,
              ])}
              <th className="daily-summary-th daily-summary-col-qty sticky top-[2.35rem] z-20 bg-haidee-surface">
                Tong
              </th>
              <th className="daily-summary-th daily-summary-col-qty sticky top-[2.35rem] z-20 bg-haidee-surface">
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
                    "daily-summary-td daily-summary-col-lorry font-mono font-medium",
                    STICKY_BODY_FIRST,
                    index % 2 === 0 ? "bg-white" : "bg-[#f9fafb]"
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
                  "daily-summary-td daily-summary-col-lorry font-bold",
                  STICKY_BODY_FIRST,
                  "bg-[#eef2f7]"
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
