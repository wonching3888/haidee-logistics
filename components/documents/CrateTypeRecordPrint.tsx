import type { CrateTypeRecordData } from "@/app/actions/documents";
import {
  formatDOCrateQuantity,
  sumColumnQuantities,
} from "@/lib/constants/tong-columns";
import "./document-print.css";

interface CrateTypeRecordPrintProps {
  data: CrateTypeRecordData;
}

/** Prefer server-computed block.totals; fall back to summing truck rows. */
function blockSubtotalQty(
  block: CrateTypeRecordData["blocks"][number],
  columnCode: string
): number {
  const fromTotals = block.totals?.[columnCode];
  if (typeof fromTotals === "number" && Number.isFinite(fromTotals)) {
    return fromTotals;
  }
  return sumColumnQuantities(block.trucks, columnCode);
}

function CrateRecordColGroup({
  activeColumns,
}: {
  activeColumns: CrateTypeRecordData["activeColumns"];
}) {
  return (
    <colgroup>
      <col className="crate-record-no-col" />
      <col className="crate-record-lorry-col" />
      {activeColumns.map((col) => (
        <col key={col.code} className="crate-record-crate-col" />
      ))}
      <col className="crate-record-total-col" />
    </colgroup>
  );
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
            <CrateRecordColGroup activeColumns={activeColumns} />
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
                <td className="crate-record-no-col text-left">小计 Subtotal</td>
                <td className="crate-record-lorry-col">&nbsp;</td>
                {activeColumns.map((col) => {
                  const qty = blockSubtotalQty(block, col.code);
                  return (
                    <td key={col.code} className="crate-record-crate-col">
                      {formatDOCrateQuantity(col.code, qty)}
                    </td>
                  );
                })}
                <td className="crate-record-total-col">{block.total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      <table className="crate-record-table crate-record-sum-table">
        <CrateRecordColGroup activeColumns={activeColumns} />
        <thead className="crate-record-sum-thead" aria-hidden="true">
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
          <tr className="totals-row">
            <td className="crate-record-no-col text-left">Sum Total</td>
            <td className="crate-record-lorry-col">&nbsp;</td>
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
