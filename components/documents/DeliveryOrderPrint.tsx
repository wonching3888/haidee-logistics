import type { DeliveryOrderData } from "@/app/actions/documents";
import {
  formatDOCrateQuantity,
  getActiveDOColumns,
  sumQuantities,
} from "@/lib/constants/tong-columns";
import { paginateRows } from "@/lib/document-utils";
import "./document-print.css";

interface DeliveryOrderPrintProps {
  data: DeliveryOrderData;
  showConsignor: boolean;
}

export function DeliveryOrderPrint({
  data,
  showConsignor,
}: DeliveryOrderPrintProps) {
  const pages = paginateRows(data.rows);
  const totals = sumQuantities(data.rows);
  const activeColumns = getActiveDOColumns(data.rows);
  const grandQty = data.rows.reduce((s, r) => s + r.qty, 0);

  return (
    <div className="document-print">
      {pages.map((pageRows, pageIdx) => (
        <div
          key={pageIdx}
          className={pageIdx < pages.length - 1 ? "page-break" : ""}
        >
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
                {showConsignor && <th className="do-consignor-col">Consignor</th>}
                <th className="do-store-col">Store</th>
                <th className="do-area-col">Area</th>
                {activeColumns.map((c) => (
                  <th key={c.code} className="do-crate-col">
                    {c.header}
                  </th>
                ))}
                <th className="do-qty-col">Qty</th>
                <th className="do-remarks-col">备注</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => (
                <tr key={i}>
                  <td className="do-no-col">{pageIdx * 22 + i + 1}</td>
                  {showConsignor && (
                    <td className="do-consignor-col text-left">{row.consignor}</td>
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
              ))}
              {pageIdx === pages.length - 1 && (
                <tr className="totals-row">
                  <td
                    colSpan={showConsignor ? 4 : 3}
                    className="text-left"
                  >
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
              )}
            </tbody>
          </table>

          <div className="signature-row">
            <span>AGENT/RECEIVER _______________</span>
            <span>HAI DEE LOGISTICS CO.,LTD _______________</span>
          </div>
          <div style={{ textAlign: "right", marginTop: 8, fontSize: 10 }}>
            页: {pageIdx + 1}/{pages.length}
          </div>
        </div>
      ))}
    </div>
  );
}
