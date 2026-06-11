import type { CrateByTypeMergedData } from "@/app/actions/documents";
import "./document-print.css";

interface CrateByTypePrintProps {
  data: CrateByTypeMergedData;
}

function CrateSection({
  marketCode,
  tongHeader,
  rows,
}: CrateByTypeMergedData["sections"][number]) {
  const total = rows.reduce((s, r) => s + r.quantity, 0);

  return (
    <div className="crate-by-type-section" style={{ marginTop: 16 }}>
      <div className="header-sub">
        地区 {marketCode} · {tongHeader}
      </div>
      <table>
        <thead>
          <tr>
            <th>罗哩车牌</th>
            <th>档口</th>
            <th>地区</th>
            <th>{tongHeader}</th>
            <th>数量</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>{row.lorryNo}</td>
              <td>{row.stallCode}</td>
              <td>{row.area}</td>
              <td>{row.quantity}</td>
              <td>{row.quantity}桶</td>
            </tr>
          ))}
          <tr className="totals-row">
            <td colSpan={3} className="text-left">
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

export function CrateByTypePrint({ data }: CrateByTypePrintProps) {
  const grandTotal = data.sections.reduce(
    (sum, section) =>
      sum + section.rows.reduce((s, r) => s + r.quantity, 0),
    0
  );

  const tongLabels = Array.from(
    new Set(data.sections.map((s) => s.tongHeader))
  ).join(" / ");

  return (
    <div className="document-print">
      <div className="header-title">海利物流有限公司</div>
      <div className="header-sub">HAI DEE LOGISTICS CO., LTD,</div>
      <div className="header-title" style={{ marginTop: 8 }}>
        *** 每日渔桶寄至 ***
      </div>
      <div className="header-sub">Crate by Area/Owner ({tongLabels})</div>
      <div className="header-sub">日期：{data.date}</div>

      {data.sections.map((section) => (
        <CrateSection key={`${section.marketCode}:${section.tongCode}`} {...section} />
      ))}

      {data.sections.length > 1 && (
        <div
          style={{
            marginTop: 16,
            textAlign: "right",
            fontWeight: "bold",
            fontSize: 12,
          }}
        >
          全部合计 Grand Total: {grandTotal}桶
        </div>
      )}
    </div>
  );
}
