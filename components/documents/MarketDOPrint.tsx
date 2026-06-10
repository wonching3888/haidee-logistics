import type { MarketDOData } from "@/app/actions/documents";
import { MARKET_DISPLAY_NAMES } from "@/lib/constants/market-names";
import {
  DO_TONG_COLUMNS,
  formatDOCrateQuantity,
  sumQuantities,
} from "@/lib/constants/tong-columns";
import "./document-print.css";

interface MarketDOPrintProps {
  data: MarketDOData;
}

export function MarketDOPrint({ data }: MarketDOPrintProps) {
  const codes = data.marketCodes?.length ? data.marketCodes : [data.marketCode];
  const titleMarkets = codes
    .map((c) => MARKET_DISPLAY_NAMES[c] ?? c)
    .join(" / ");
  const totals = sumQuantities(data.rows);
  const grandTotal = data.rows.reduce((s, r) => s + r.qty, 0);

  return (
    <div className="document-print">
      <div className="header-title">海利物流有限公司</div>
      <div className="header-sub">
        HAI DEE LOGISTICS CO., LTD,
      </div>
      <div className="header-title" style={{ marginTop: 8 }}>
        *** 每日渔桶寄至 {titleMarkets} ***
      </div>
      <div className="header-sub">Despatch List by Area Details</div>
      <div className="header-sub">日期：{data.date}</div>

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>罗哩车牌</th>
            <th>收货商号</th>
            <th>摊位</th>
            <th>地区</th>
            {DO_TONG_COLUMNS.map((c) => (
              <th key={c.code}>{c.header}</th>
            ))}
            <th>数量</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i}>
              <td>{row.lorryNo}</td>
              <td className="text-left">{row.receiverName}</td>
              <td>{row.stallCode}</td>
              <td>{row.area}</td>
              {DO_TONG_COLUMNS.map((c) => (
                <td key={c.code}>
                  {formatDOCrateQuantity(c.code, row.quantities[c.code] ?? 0)}
                </td>
              ))}
              <td>{row.qty}</td>
            </tr>
          ))}
          <tr className="totals-row">
            <td colSpan={4} className="text-left">
              总计
            </td>
            {DO_TONG_COLUMNS.map((c) => (
              <td key={c.code}>
                {formatDOCrateQuantity(c.code, totals[c.code] ?? 0)}
              </td>
            ))}
            <td>{grandTotal}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ textAlign: "center", marginTop: 16, fontWeight: "bold" }}>
        完毕
      </div>
    </div>
  );
}
