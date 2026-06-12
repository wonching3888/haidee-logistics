import type { DeliveryOrderData } from "@/app/actions/documents";
import {
  formatDOCrateQuantity,
  getActiveDOColumns,
  sumQuantities,
} from "@/lib/constants/tong-columns";
import { groupRowsByAreaAndTruck } from "@/lib/market-do-grouping";
import {
  flattenAreaGroupRows,
  GroupedAreaTruckRows,
} from "@/components/documents/GroupedAreaTruckRows";
import "./document-print.css";

interface DeliveryOrderPrintProps {
  data: DeliveryOrderData;
  showConsignor: boolean;
}

export function DeliveryOrderPrint({
  data,
  showConsignor,
}: DeliveryOrderPrintProps) {
  const activeColumns = getActiveDOColumns(data.rows);
  const totals = sumQuantities(data.rows);
  const grandQty = data.rows.reduce((s, r) => s + r.qty, 0);
  const areaGroups = groupRowsByAreaAndTruck(data.rows);
  const fixedColCount =
    2 + (showConsignor ? 1 : 0) + activeColumns.length + 2;
  let rowNo = 0;

  return (
    <div className="document-print">
      <div className="header-title">
        海利物流有限公司 HAI DEE LOGISTICS CO.,LTD
      </div>
      <div className="header-row">
        <span>LORRY NO: {data.lorryNo}</span>
        <span style={{ fontWeight: "bold" }}>*** DELIVERY ORDER ***</span>
        <span>NO: {data.doNumber}</span>
      </div>
      <div className="header-row">
        <span>DRIVER: {data.driver}</span>
        <span>DATE: {data.date}</span>
      </div>

      <table className="do-table">
        <thead>
          <tr>
            <th className="do-no-col">No</th>
            <th className="do-lorry-col">Lorry</th>
            {showConsignor && <th className="do-consignor-col">Consignor</th>}
            <th className="do-store-col">Store</th>
            <th className="do-area-col">Area</th>
            {activeColumns.map((c) => (
              <th key={c.code} className="do-crate-col">
                {c.header}
              </th>
            ))}
            <th className="do-qty-col">Qty</th>
            <th className="do-remarks-col">备注 Remarks</th>
          </tr>
        </thead>
        <tbody>
          <GroupedAreaTruckRows
            areaGroups={areaGroups}
            colSpan={fixedColCount}
            rowKey={(row) => `${row.lorryNo}:${row.store}:${row.consignor}`}
            renderRow={(row) => {
              rowNo += 1;
              return (
                <tr>
                  <td className="do-no-col">{rowNo}</td>
                  <td className="do-lorry-col">{row.lorryNo}</td>
                  {showConsignor && (
                    <td className="do-consignor-col text-left">
                      {row.consignor}
                    </td>
                  )}
                  <td className="do-store-col">{row.store}</td>
                  <td className="do-area-col">{row.area}</td>
                  {activeColumns.map((c) => (
                    <td key={c.code} className="do-crate-col">
                      {formatDOCrateQuantity(
                        c.code,
                        row.quantities[c.code] ?? 0
                      )}
                    </td>
                  ))}
                  <td className="do-qty-col">{row.qty}</td>
                  <td className="do-remarks-col">&nbsp;</td>
                </tr>
              );
            }}
            renderAreaSubtotal={(areaGroup) => {
              const areaQty = flattenAreaGroupRows(areaGroup).reduce(
                (sum, row) => sum + row.qty,
                0
              );
              return (
                <tr className="area-subtotal-row">
                  <td colSpan={showConsignor ? 5 : 4} className="text-left">
                    小计 Subtotal
                  </td>
                  {activeColumns.map((c) => (
                    <td key={c.code} className="do-crate-col">
                      &nbsp;
                    </td>
                  ))}
                  <td className="do-qty-col">{areaQty}</td>
                  <td className="do-remarks-col">&nbsp;</td>
                </tr>
              );
            }}
          />
          <tr className="totals-row">
            <td colSpan={showConsignor ? 5 : 4} className="text-left">
              Total:
            </td>
            {activeColumns.map((c) => (
              <td key={c.code} className="do-crate-col">
                {formatDOCrateQuantity(c.code, totals[c.code] ?? 0)}
              </td>
            ))}
            <td className="do-qty-col">{grandQty}</td>
            <td className="do-remarks-col">&nbsp;</td>
          </tr>
        </tbody>
      </table>

      <div className="signature-row">
        <span>AGENT/RECEIVER _______________</span>
        <span>HAI DEE LOGISTICS CO.,LTD _______________</span>
      </div>
    </div>
  );
}
