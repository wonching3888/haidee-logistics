import type { DeliveryOrderData } from "@/app/actions/documents";
import { getActiveDOColumns } from "@/lib/constants/tong-columns";
import { MARKET_DO_LANDSCAPE_COLUMN_THRESHOLD } from "@/lib/market-do-route-groups";
import { DeliveryOrderSectionPrint } from "@/components/documents/DeliveryOrderSectionPrint";
import { PrintLetterhead } from "@/components/shared/PrintLogo";
import "./document-print.css";

interface DeliveryOrderPrintProps {
  data: DeliveryOrderData;
  showConsignor: boolean;
}

export function DeliveryOrderPrint({
  data,
  showConsignor,
}: DeliveryOrderPrintProps) {
  const sections = data.sections ?? [];
  const maxActiveColumns = sections.reduce(
    (max, section) =>
      Math.max(max, getActiveDOColumns(section.rows).length),
    0
  );
  const useLandscape = maxActiveColumns >= MARKET_DO_LANDSCAPE_COLUMN_THRESHOLD;

  if (sections.length === 0) {
    return (
      <div className="document-print delivery-order-document">
        <PrintLetterhead />
        <div className="header-row">
          <span>LORRY NO: {data.lorryNo}</span>
          <span style={{ fontWeight: "bold" }}>*** DELIVERY ORDER ***</span>
          <span>NO: {data.doNumber}</span>
        </div>
        <div className="header-row">
          <span>DRIVER: {data.driver}</span>
          <span>DATE: {data.date}</span>
        </div>
        <p
          className="text-center text-haidee-muted"
          style={{ marginTop: 24, padding: 24 }}
        >
          暂无货物 No cargo on this dispatch
        </p>
      </div>
    );
  }

  return (
    <div
      className={`document-print delivery-order-document${
        useLandscape ? " delivery-order-landscape" : ""
      }`}
      data-delivery-order-section-count={sections.length}
      data-delivery-order-max-columns={maxActiveColumns}
    >
      {sections.map((section, index) => (
        <div key={section.routeGroup}>
          {index > 0 ? <div className="page-break" aria-hidden="true" /> : null}
          <DeliveryOrderSectionPrint
            section={section}
            doNumber={data.doNumber}
            lorryNo={data.lorryNo}
            driver={data.driver}
            date={data.date}
            showConsignor={showConsignor}
          />
        </div>
      ))}
    </div>
  );
}
