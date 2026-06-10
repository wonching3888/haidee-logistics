import type { CrateByTypeData } from "@/app/actions/documents";
import "./document-print.css";

interface CrateByTypePrintProps {
  data: CrateByTypeData;
}

export function CrateByTypePrint({ data }: CrateByTypePrintProps) {
  const total = data.rows.reduce((s, r) => s + r.quantity, 0);

  return (
    <div className="document-print">
      <div className="header-title">海利物流有限公司</div>
      <div className="header-sub">HAI DEE LOGISTICS CO., LTD,</div>
      <div className="header-title" style={{ marginTop: 8 }}>
        *** 每日渔桶寄至 ***
      </div>
      <div className="header-sub">
        Crate by Area/Owner ({data.tongHeader})
      </div>
      <div className="header-sub">
        地区 {data.marketCode} · 日期：{data.date}
      </div>

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>罗哩车牌</th>
            <th>收货商号</th>
            <th>摊位</th>
            <th>地区</th>
            <th>{data.tongHeader}</th>
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
              <td>{row.quantity}</td>
              <td>{row.quantity}桶</td>
            </tr>
          ))}
          <tr className="totals-row">
            <td colSpan={4} className="text-left">
              总计
            </td>
            <td>{total}</td>
            <td>{total}桶</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
