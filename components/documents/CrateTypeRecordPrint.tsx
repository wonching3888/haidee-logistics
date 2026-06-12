import type { CrateTypeRecordData } from "@/app/actions/documents";
import { formatDOCrateQuantity } from "@/lib/constants/tong-columns";
import "./document-print.css";

interface CrateTypeRecordPrintProps {
  data: CrateTypeRecordData;
}

export function CrateTypeRecordPrint({ data }: CrateTypeRecordPrintProps) {
  const { activeColumns } = data;
  return (
    <div className="document-print">
      <div className="header-title">海利物流有限公司</div>
      <div className="header-sub">HAI DEE LOGISTICS CO., LTD</div>
      <div className="header-title" style={{ marginTop: 8 }}>
        Crate Type Record
      </div>
      <div className="header-sub">桶型总计</div>
      <div className="header-sub">日期 Date：{data.date}</div>

      {data.blocks.map((block) => (
        <div key={block.title} className="crate-record-block">
          <div className="crate-record-block-title">{block.title}</div>
          <table className="crate-record-table">
            <thead>
              <tr>
                <th className="crate-record-no-col">No</th>
                <th className="crate-record-lorry-col">Lorry No</th>
                {activeColumns.map((col) => (
                  <th key={col.code} className="crate-record-crate-col">
                    {col.header}
                  </th>
                ))}
                <th className="crate-record-total-col">Total</th>
              </tr>
            </thead>
            <tbody>
              {block.trucks.map((truck, index) => (
                <tr key={truck.lorryNo}>
                  <td className="crate-record-no-col">{index + 1}</td>
                  <td className="crate-record-lorry-col">{truck.lorryNo}</td>
                  {activeColumns.map((col) => (
                    <td key={col.code} className="crate-record-crate-col">
                      {formatDOCrateQuantity(
                        col.code,
                        truck.quantities[col.code] ?? 0
                      )}
                    </td>
                  ))}
                  <td className="crate-record-total-col">{truck.total}</td>
                </tr>
              ))}
              <tr className="area-subtotal-row">
                <td colSpan={2} className="text-left">
                  小计 Subtotal
                </td>
                {activeColumns.map((col) => (
                  <td key={col.code} className="crate-record-crate-col">
                    &nbsp;
                  </td>
                ))}
                <td className="crate-record-total-col">{block.total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      <table className="crate-record-table crate-record-sum-table">
        <tbody>
          <tr className="totals-row">
            <td colSpan={2} className="text-left">
              Sum Total
            </td>
            {activeColumns.map((col) => (
              <td key={col.code} className="crate-record-crate-col">
                {formatDOCrateQuantity(
                  col.code,
                  data.grandTotals[col.code] ?? 0
                )}
              </td>
            ))}
            <td className="crate-record-total-col">{data.grandTotal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
