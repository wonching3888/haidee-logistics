import type { DeliveryOrderSection } from "@/app/actions/documents";
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

/** Handwritten on paper after print — never bind inbound/session fields here. */
const BLANK_REMARKS_CELL = "\u00A0";

interface DeliveryOrderSectionPrintProps {
  section: DeliveryOrderSection;
  doNumber: string;
  lorryNo: string;
  driver: string;
  date: string;
  showConsignor: boolean;
}

export function DeliveryOrderSectionPrint({
  section,
  doNumber,
  lorryNo,
  driver,
  date,
  showConsignor,
}: DeliveryOrderSectionPrintProps) {
  const activeColumns = getActiveDOColumns(section.rows);
  const totals = sumQuantities(section.rows);
  const grandQty = section.rows.reduce((sum, row) => sum + row.qty, 0);
  const areaGroups = groupRowsByAreaAndTruck(section.rows);
  const colsBeforeCrates = showConsignor ? 4 : 3;
  const totalColSpan = colsBeforeCrates + activeColumns.length + 2;
  let rowNo = 0;

  return (
    <div
      className="delivery-order-print-section"
      data-route-group={section.routeGroup}
    >
      <PrintLetterhead />
      <div className="header-row">
        <span>LORRY NO: {lorryNo}</span>
        <span style={{ fontWeight: "bold" }}>
          *** DELIVERY ORDER ({section.routeGroup}) ***
        </span>
        <span>NO: {doNumber}</span>
      </div>
      <div className="header-row">
        <span>DRIVER: {driver}</span>
        <span>DATE: {date}</span>
      </div>

      <table className="do-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th className="do-no-col">No</th>
            {showConsignor && <th className="do-consignor-col">Consignor</th>}
            <th className="do-store-col">Store</th>
            <th className="do-area-col">Area</th>
            {activeColumns.map((column) => (
              <th key={column.code} className="do-crate-col">
                {column.header}
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
                <tr className="do-data-row">
                  <td className="do-no-col">{rowNo}</td>
                  {showConsignor && (
                    <td className="do-consignor-col text-left">
                      {row.consignor}
                    </td>
                  )}
                  <td className="do-store-col">{row.store}</td>
                  <td className="do-area-col">{row.area}</td>
                  {activeColumns.map((column) => (
                    <td key={column.code} className="do-crate-col">
                      {formatDOCrateQuantity(
                        column.code,
                        row.quantities[column.code] ?? 0
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
                  {activeColumns.map((column) => (
                    <td key={column.code} className="do-crate-col">
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
            {activeColumns.map((column) => (
              <td key={column.code} className="do-crate-col">
                {formatDOCrateQuantity(column.code, totals[column.code] ?? 0)}
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

      <div
        className="document-print-footer"
        style={{ textAlign: "center", marginTop: 16 }}
      >
        完毕
      </div>
    </div>
  );
}
