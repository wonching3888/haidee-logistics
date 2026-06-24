import type { MarketDOSection } from "@/app/actions/documents";
import {
  formatDOCrateQuantity,
  getActiveDOColumns,
  sumQuantities,
} from "@/lib/constants/tong-columns";
import { groupMarketDORows } from "@/lib/market-do-grouping";
import {
  flattenAreaGroupRows,
  GroupedAreaTruckRows,
} from "@/components/documents/GroupedAreaTruckRows";
import { PrintLetterhead } from "@/components/shared/PrintLogo";

interface MarketDOSectionPrintProps {
  section: MarketDOSection;
  date: string;
}

export function MarketDOSectionPrint({ section, date }: MarketDOSectionPrintProps) {
  const activeColumns = getActiveDOColumns(section.rows);
  const totals = sumQuantities(section.rows);
  const grandTotal = section.rows.reduce((sum, row) => sum + row.qty, 0);
  const areaGroups = groupMarketDORows(section.rows);
  const colSpan = 3 + activeColumns.length + 1;

  return (
    <div
      className="market-do-print-section"
      data-route-group={section.routeGroup}
    >
      <PrintLetterhead nameEn="HAI DEE LOGISTICS CO., LTD," />
      <div className="header-title" style={{ marginTop: 8 }}>
        市场 D/O — {section.routeGroup}
      </div>
      <div className="header-sub">Despatch List by Area Details</div>
      <div className="header-sub">日期：{date}</div>

      <table className="market-do-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th className="market-do-lorry-col">罗哩车牌</th>
            <th className="market-do-stall-col">收货人</th>
            <th className="market-do-area-col">地区</th>
            {activeColumns.map((column) => (
              <th key={column.code} className="market-do-crate-col">
                {column.header}
              </th>
            ))}
            <th className="market-do-qty-col">数量</th>
          </tr>
        </thead>
        <tbody>
          <GroupedAreaTruckRows
            areaGroups={areaGroups}
            colSpan={colSpan}
            rowKey={(row) => `${row.lorryNo}:${row.stallCode}`}
            renderRow={(row) => (
              <tr className="market-do-data-row">
                <td className="market-do-lorry-col">{row.lorryNo}</td>
                <td className="market-do-stall-col">{row.stallCode}</td>
                <td className="market-do-area-col">{row.area}</td>
                {activeColumns.map((column) => (
                  <td key={column.code} className="market-do-crate-col">
                    {formatDOCrateQuantity(
                      column.code,
                      row.quantities[column.code] ?? 0
                    )}
                  </td>
                ))}
                <td className="market-do-qty-col">{row.qty}</td>
              </tr>
            )}
            renderTruckSubtotal={(truck) => {
              const lorryQty = truck.rows.reduce(
                (sum, row) => sum + row.qty,
                0
              );
              return (
                <tr className="lorry-subtotal-row">
                  <td colSpan={3} className="text-left">
                    小计 Subtotal
                  </td>
                  {activeColumns.map((column) => (
                    <td key={column.code} className="market-do-crate-col">
                      &nbsp;
                    </td>
                  ))}
                  <td className="market-do-qty-col">{lorryQty}</td>
                </tr>
              );
            }}
            renderAreaSubtotal={(areaGroup) => {
              const areaQty = flattenAreaGroupRows(areaGroup).reduce(
                (sum, row) => sum + row.qty,
                0
              );
              return (
                <tr className="area-total-row">
                  <td colSpan={3} className="text-left">
                    {areaGroup.areaName} 合计
                  </td>
                  {activeColumns.map((column) => (
                    <td key={column.code} className="market-do-crate-col">
                      &nbsp;
                    </td>
                  ))}
                  <td className="market-do-qty-col">{areaQty}</td>
                </tr>
              );
            }}
          />
          <tr className="totals-row">
            <td colSpan={3} className="text-left">
              总计 Grand Total
            </td>
            {activeColumns.map((column) => (
              <td key={column.code} className="market-do-crate-col">
                {formatDOCrateQuantity(column.code, totals[column.code] ?? 0)}
              </td>
            ))}
            <td className="market-do-qty-col">{grandTotal}</td>
          </tr>
        </tbody>
      </table>

      <div
        className="document-print-footer"
        style={{ textAlign: "center", marginTop: 16 }}
      >
        完毕
      </div>
    </div>
  );
}
