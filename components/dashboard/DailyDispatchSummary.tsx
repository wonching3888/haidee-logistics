import type { DailyDispatchSummaryData, DepotQty } from "@/app/actions/dashboard";
import "./daily-dispatch-summary.css";

const stickyFirstColHeader =
  "max-md:sticky max-md:left-0 max-md:z-20 max-md:bg-[#c8e6c9]";
const stickyFirstColEven = "max-md:sticky max-md:left-0 max-md:z-10 max-md:bg-white";
const stickyFirstColOdd = "max-md:sticky max-md:left-0 max-md:z-10 max-md:bg-[#f1f8f4]";
const stickyFirstColTotal =
  "max-md:sticky max-md:left-0 max-md:z-10 max-md:bg-[#e8f5e9]";

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
    <div
      className="daily-summary-print rounded-xl border border-haidee-border bg-white"
      style={{
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
      }}
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
              className="daily-summary-table border-collapse text-sm md:w-full"
              style={{ minWidth: "max-content", width: "100%" }}
            >
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className={`daily-summary-th daily-summary-col-lorry text-left ${stickyFirstColHeader}`}
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
                    <td
                      className={`daily-summary-td daily-summary-col-lorry font-mono font-medium text-left ${
                        index % 2 === 0 ? stickyFirstColEven : stickyFirstColOdd
                      }`}
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
                    className={`daily-summary-td daily-summary-col-lorry font-bold text-left ${stickyFirstColTotal}`}
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
    </div>
  );
}
