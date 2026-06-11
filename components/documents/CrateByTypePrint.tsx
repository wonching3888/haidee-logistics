import type { CrateByTypeMergedData, CrateByTypeRow } from "@/app/actions/documents";
import { groupRowsByAreaAndTruck } from "@/lib/market-do-grouping";
import { GroupedAreaTruckRows } from "@/components/documents/GroupedAreaTruckRows";
import "./document-print.css";

interface CrateByTypePrintProps {
  data: CrateByTypeMergedData;
}

interface TongSection {
  tongHeader: string;
  rows: CrateByTypeRow[];
}

function buildTongSections(
  sections: CrateByTypeMergedData["sections"]
): TongSection[] {
  const byTong = new Map<string, CrateByTypeRow[]>();

  for (const section of sections) {
    const existing = byTong.get(section.tongCode) ?? [];
    byTong.set(section.tongCode, [...existing, ...section.rows]);
  }

  return sections
    .filter(
      (section, index, all) =>
        all.findIndex((s) => s.tongCode === section.tongCode) === index
    )
    .map((section) => ({
      tongHeader: section.tongHeader,
      rows: byTong.get(section.tongCode) ?? [],
    }));
}

function CrateTongTable({
  tongHeader,
  rows,
}: {
  tongHeader: string;
  rows: CrateByTypeRow[];
}) {
  const areaGroups = groupRowsByAreaAndTruck(rows);
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);
  const colSpan = 5;

  return (
    <table className="market-do-table" style={{ marginTop: 16 }}>
      <thead>
        <tr>
          <th className="market-do-lorry-col">罗哩车牌</th>
          <th className="market-do-stall-col">档口</th>
          <th className="market-do-area-col">地区</th>
          <th className="market-do-crate-col">{tongHeader}</th>
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
              <td className="market-do-crate-col">{row.quantity}</td>
              <td className="market-do-qty-col">{row.quantity}桶</td>
            </tr>
          )}
        />
        <tr className="totals-row">
          <td colSpan={3} className="text-left">
            总计
          </td>
          <td className="market-do-crate-col">{total}</td>
          <td className="market-do-qty-col">{total}桶</td>
        </tr>
      </tbody>
    </table>
  );
}

export function CrateByTypePrint({ data }: CrateByTypePrintProps) {
  const tongSections = buildTongSections(data.sections);
  const grandTotal = data.sections.reduce(
    (sum, section) =>
      sum + section.rows.reduce((sectionSum, row) => sectionSum + row.quantity, 0),
    0
  );

  const tongLabels = tongSections.map((section) => section.tongHeader).join(" / ");

  return (
    <div className="document-print">
      <div className="header-title">海利物流有限公司</div>
      <div className="header-sub">HAI DEE LOGISTICS CO., LTD,</div>
      <div className="header-title" style={{ marginTop: 8 }}>
        *** 每日渔桶寄至 ***
      </div>
      <div className="header-sub">Crate by Area/Owner ({tongLabels})</div>
      <div className="header-sub">日期：{data.date}</div>

      {tongSections.map((section) => (
        <CrateTongTable
          key={section.tongHeader}
          tongHeader={section.tongHeader}
          rows={section.rows}
        />
      ))}

      {tongSections.length > 1 && (
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
