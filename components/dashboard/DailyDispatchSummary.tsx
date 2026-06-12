import type { DailyDispatchSummaryData, DepotQty } from "@/app/actions/dashboard";
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
    <section className="w-full min-w-0">
      <div className="daily-summary-print min-w-0 max-w-full overflow-hidden rounded-xl border border-haidee-border bg-white">
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
          <div
            className="w-full min-w-0 max-w-full overflow-x-auto max-md:touch-pan-x"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <table className="daily-summary-table w-full min-w-max border-collapse text-sm md:min-w-0">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="daily-summary-th daily-summary-col-lorry text-left"
                  >
                    Lorry No
                  </th>
                  {data.activeDepots.map((depot) => (
                    <th
                      key={depot}
                      colSpan={2}
                      className="daily-summary-th daily-summary-col-group"
                    >
                      {depot}
                    </th>
                  ))}
                  <th
                    colSpan={2}
                    className="daily-summary-th daily-summary-col-group"
                  >
                    Total
                  </th>
                </tr>
                <tr>
                  {data.activeDepots.flatMap((depot) => [
                    <th
                      key={`${depot}-tong`}
                      className="daily-summary-th daily-summary-col-qty"
                    >
                      Tong
                    </th>,
                    <th
                      key={`${depot}-box`}
                      className="daily-summary-th daily-summary-col-qty"
                    >
                      Box
                    </th>,
                  ])}
                  <th className="daily-summary-th daily-summary-col-qty">Tong</th>
                  <th className="daily-summary-th daily-summary-col-qty">Box</th>
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
                    <td className="daily-summary-td daily-summary-col-lorry font-mono font-medium text-left">
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
                  <td className="daily-summary-td daily-summary-col-lorry font-bold text-left">
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
          </div>
        )}
      </div>
    </section>
  );
}
