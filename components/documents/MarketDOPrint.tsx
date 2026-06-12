import type { MarketDOData } from "@/app/actions/documents";
import { MARKET_DISPLAY_NAMES } from "@/lib/constants/market-names";
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
import "./document-print.css";

interface MarketDOPrintProps {
  data: MarketDOData;
}

export function MarketDOPrint({ data }: MarketDOPrintProps) {
  const codes = data.marketCodes?.length ? data.marketCodes : [data.marketCode];
  const titleMarkets = codes
    .map((c) => MARKET_DISPLAY_NAMES[c] ?? c)
    .join(" / ");
  const activeColumns = getActiveDOColumns(data.rows);
  const totals = sumQuantities(data.rows);
  const grandTotal = data.rows.reduce((s, r) => s + r.qty, 0);
  const areaGroups = groupMarketDORows(data.rows);
  const colSpan = 3 + activeColumns.length + 1;

  return (
    <div className="document-print">
      <div className="header-title">海利物流有限公司</div>
      <div className="header-sub">HAI DEE LOGISTICS CO., LTD,</div>
      <div className="header-title" style={{ marginTop: 8 }}>
        *** 每日渔桶寄至 {titleMarkets} ***
      </div>
      <div className="header-sub">Despatch List by Area Details</div>
      <div className="header-sub">日期：{data.date}</div>

      <table className="market-do-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th className="market-do-lorry-col">罗哩车牌</th>
            <th className="market-do-stall-col">档口</th>
            <th className="market-do-area-col">地区</th>
            {activeColumns.map((c) => (
              <th key={c.code} className="market-do-crate-col">
                {c.header}
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
              <tr>
                <td className="market-do-lorry-col">{row.lorryNo}</td>
                <td className="market-do-stall-col">{row.stallCode}</td>
                <td className="market-do-area-col">{row.area}</td>
                {activeColumns.map((c) => (
                  <td key={c.code} className="market-do-crate-col">
                    {formatDOCrateQuantity(
                      c.code,
                      row.quantities[c.code] ?? 0
                    )}
                  </td>
                ))}
                <td className="market-do-qty-col">{row.qty}</td>
              </tr>
            )}
            renderAreaSubtotal={(areaGroup) => {
              const areaQty = flattenAreaGroupRows(areaGroup).reduce(
                (sum, row) => sum + row.qty,
                0
              );
              return (
                <tr className="area-subtotal-row">
                  <td colSpan={3} className="text-left">
                    小计 Subtotal
                  </td>
                  {activeColumns.map((c) => (
                    <td key={c.code} className="market-do-crate-col">
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
              总计
            </td>
            {activeColumns.map((c) => (
              <td key={c.code} className="market-do-crate-col">
                {formatDOCrateQuantity(c.code, totals[c.code] ?? 0)}
              </td>
            ))}
            <td className="market-do-qty-col">{grandTotal}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ textAlign: "center", marginTop: 16, fontWeight: "bold" }}>
        完毕
      </div>
    </div>
  );
}
