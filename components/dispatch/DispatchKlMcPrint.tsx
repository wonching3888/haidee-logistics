import type { DispatchKlMcPrintData } from "@/app/actions/dispatch";
import { cellDisplay, formatConsignorForKlMcPrint } from "@/lib/consignor-label";
import { t } from "@/lib/i18n/translate";
import type { UserLanguage } from "@/types";
import "@/components/documents/document-print.css";

interface DispatchKlMcPrintProps {
  data: DispatchKlMcPrintData;
  locale: UserLanguage;
}

function QtyCell({
  crate,
  box,
  locale,
}: {
  crate: number;
  box: number;
  locale: UserLanguage;
}) {
  const label = cellDisplay(crate, box, locale);
  if (!label) return null;
  return <span className="dispatch-klmc-qty">{label}</span>;
}

function ConsignorCell({ shipperName }: { shipperName: string }) {
  const { base, suffix } = formatConsignorForKlMcPrint(shipperName);
  return (
    <span className="dispatch-klmc-consignor-line">
      <span className="dispatch-klmc-consignor-base">{base}</span>
      {suffix ? (
        <span className="dispatch-klmc-consignor-suffix">{suffix}</span>
      ) : null}
    </span>
  );
}

export function DispatchKlMcPrint({ data, locale }: DispatchKlMcPrintProps) {
  const { markets, rows, colTotals, grandSubtotal } = data;

  return (
    <div className="document-print dispatch-klmc-print">
      <div className="dispatch-klmc-title">
        {t("dispatch.klMcPrintTitle", locale)} · {data.date}
      </div>

      <table className="dispatch-klmc-table">
        <thead>
          <tr>
            <th className="dispatch-klmc-col-consignor">
              {t("common.consignor", locale)}
            </th>
            <th className="dispatch-klmc-col-notes">
              {t("common.notes", locale)}
            </th>
            {markets.map((code) => (
              <th key={code} className="dispatch-klmc-col-market">
                {code}
              </th>
            ))}
            <th className="dispatch-klmc-col-total">
              {t("common.total", locale)}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={markets.length + 3} className="dispatch-klmc-empty">
                {t("dispatch.noUnassignedCargo", locale)}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.sessionId}>
                <td className="dispatch-klmc-col-consignor">
                  <ConsignorCell shipperName={row.shipperName} />
                </td>
                <td className="dispatch-klmc-col-notes">{row.areaNote}</td>
                {markets.map((code) => {
                  const qty = row.cells[code] ?? { crate: 0, box: 0 };
                  return (
                    <td key={code} className="dispatch-klmc-col-market">
                      <QtyCell
                        crate={qty.crate}
                        box={qty.box}
                        locale={locale}
                      />
                    </td>
                  );
                })}
                <td className="dispatch-klmc-col-total">
                  <QtyCell
                    crate={row.rowSubtotal.crate}
                    box={row.rowSubtotal.box}
                    locale={locale}
                  />
                </td>
              </tr>
            ))
          )}
          {rows.length > 0 ? (
            <tr className="dispatch-klmc-totals-row">
              <td colSpan={2} className="dispatch-klmc-totals-label">
                {t("dispatch.marketTotals", locale)}
              </td>
              {markets.map((code) => {
                const qty = colTotals[code] ?? { crate: 0, box: 0 };
                return (
                  <td key={code} className="dispatch-klmc-col-market">
                    <QtyCell
                      crate={qty.crate}
                      box={qty.box}
                      locale={locale}
                    />
                  </td>
                );
              })}
              <td className="dispatch-klmc-col-total">
                <QtyCell
                  crate={grandSubtotal.crate}
                  box={grandSubtotal.box}
                  locale={locale}
                />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
