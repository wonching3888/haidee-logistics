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
import { PrintLetterhead } from "@/components/shared/PrintLogo";
import "./document-print.css";

/** Handwritten on paper after print — never bind inbound/session fields here. */
const BLANK_REMARKS_CELL = "\u00A0";

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
  const colsBeforeCrates = showConsignor ? 5 : 4;
  const totalColSpan = colsBeforeCrates + activeColumns.length + 2;
  let rowNo = 0;

  return (
    <div className="document-print">
      <PrintLetterhead />
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
            colSpan={totalColSpan}
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
                  <td className="do-remarks-col">{BLANK_REMARKS_CELL}</td>
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
                  <td colSpan={colsBeforeCrates} className="text-left">
                    小计 Subtotal
                  </td>
                  {activeColumns.map((c) => (
                    <td key={c.code} className="do-crate-col">
                      &nbsp;
                    </td>
                  ))}
                  <td className="do-qty-col">{areaQty}</td>
                  <td className="do-remarks-col">{BLANK_REMARKS_CELL}</td>
                </tr>
              );
            }}
          />
          <tr className="totals-row">
            <td colSpan={colsBeforeCrates} className="text-left">
              Total:
            </td>
            {activeColumns.map((c) => (
              <td key={c.code} className="do-crate-col">
                {formatDOCrateQuantity(c.code, totals[c.code] ?? 0)}
              </td>
            ))}
            <td className="do-qty-col">{grandQty}</td>
            <td className="do-remarks-col">{BLANK_REMARKS_CELL}</td>
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
