import type { DeliveryOrderData } from "@/app/actions/documents";
import { DO_TONG_COLUMNS, sumQuantities } from "@/lib/constants/tong-columns";
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

          <table>
            <thead>
              <tr>
                <th>No</th>
                {showConsignor && <th>Consignor</th>}
                <th>Store</th>
                <th>Area</th>
                {DO_TONG_COLUMNS.map((c) => (
                  <th key={c.code}>{c.header}</th>
                ))}
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => (
                <tr key={i}>
                  <td>{pageIdx * 22 + i + 1}</td>
                  {showConsignor && (
                    <td className="text-left">{row.consignor}</td>
                  )}
                  <td>{row.store}</td>
                  <td>{row.area}</td>
                  {DO_TONG_COLUMNS.map((c) => (
                    <td key={c.code}>
                      {row.quantities[c.code] > 0
                        ? row.quantities[c.code]
                        : ""}
                    </td>
                  ))}
                  <td>{row.qty}</td>
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
                  {DO_TONG_COLUMNS.map((c) => (
                    <td key={c.code}>
                      {totals[c.code] > 0 ? totals[c.code] : ""}
                    </td>
                  ))}
                  <td>
                    {data.rows.reduce((s, r) => s + r.qty, 0)}
                  </td>
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
