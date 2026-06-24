import type { MarketDOData } from "@/app/actions/documents";
import { getActiveDOColumns } from "@/lib/constants/tong-columns";
import { MARKET_DO_LANDSCAPE_COLUMN_THRESHOLD } from "@/lib/market-do-route-groups";
import { MarketDOSectionPrint } from "@/components/documents/MarketDOSectionPrint";
import { PrintLetterhead } from "@/components/shared/PrintLogo";
import "./document-print.css";

interface MarketDOPrintProps {
  data: MarketDOData;
}

export function MarketDOPrint({ data }: MarketDOPrintProps) {
  const sections = data.sections ?? [];
  const maxActiveColumns = sections.reduce(
    (max, section) =>
      Math.max(max, getActiveDOColumns(section.rows).length),
    0
  );
  const useLandscape = maxActiveColumns >= MARKET_DO_LANDSCAPE_COLUMN_THRESHOLD;

  if (sections.length === 0) {
    return (
      <div className="document-print market-do-document">
        <PrintLetterhead nameEn="HAI DEE LOGISTICS CO., LTD," />
        <div className="header-title" style={{ marginTop: 8 }}>
          市场 D/O Market D/O
        </div>
        <div className="header-sub">Despatch List by Area Details</div>
        <div className="header-sub">日期：{data.date}</div>
        <p
          className="text-center text-haidee-muted"
          style={{ marginTop: 24, padding: 24 }}
        >
          当日暂无派车货物 No dispatched cargo for this date
        </p>
      </div>
    );
  }

  return (
    <div
      className={`document-print market-do-document${
        useLandscape ? " market-do-landscape" : ""
      }`}
      data-market-do-section-count={sections.length}
      data-market-do-max-columns={maxActiveColumns}
    >
      {sections.map((section, index) => (
        <div key={section.routeGroup}>
          {index > 0 ? <div className="page-break" aria-hidden="true" /> : null}
          <MarketDOSectionPrint section={section} date={data.date} />
        </div>
      ))}
    </div>
  );
}
