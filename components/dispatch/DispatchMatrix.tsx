"use client";

import type { DispatchMatrixData } from "@/app/actions/dispatch";
import { DispatchMarketLabel } from "@/components/dispatch/DispatchMarketLabel";
import { MobileTruncatedName } from "@/components/shared/MobileTruncatedName";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { STICKY_BODY_FIRST, STICKY_HEAD_FIRST, STICKY_HEAD_TOP } from "@/lib/table-scroll";
import { cellDisplay } from "@/lib/consignor-label";
import { getMessageParts, t } from "@/lib/i18n/translate";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import type { UserLanguage } from "@/types";

interface DispatchMatrixProps {
  data: DispatchMatrixData;
  locale: UserLanguage;
}

function emptyQty() {
  return { crate: 0, box: 0 };
}

function TotalsCellDisplay({
  crate,
  box,
  locale,
  align = "center",
}: {
  crate: number;
  box: number;
  locale: UserLanguage;
  align?: "center" | "end";
}) {
  if (crate === 0 && box === 0) return null;
  const label = cellDisplay(crate, box, locale);
  if (!label.includes("+")) {
    return <>{label}</>;
  }
  const [cratePart, boxPart] = label.split("+");
  return (
    <div
      className={cn(
        "flex flex-col leading-tight",
        align === "end" ? "items-end" : "items-center"
      )}
    >
      <span>{cratePart}</span>
      <span className="text-xs font-normal">{boxPart}</span>
    </div>
  );
}

function BilingualHead({
  messageKey,
  locale,
  className,
}: {
  messageKey: MessageKey;
  locale: UserLanguage;
  className?: string;
}) {
  const { local, en } = getMessageParts(messageKey, locale);
  return (
    <th className={className}>
      <div>{local}</div>
      {en ? <div className="text-[10px] font-normal text-haidee-muted">{en}</div> : null}
    </th>
  );
}

/** Height of the market-label header row — row 2 sticks directly beneath it. */
const MARKET_HEADER_ROW_TOP = "3rem";

const MARKET_COL_CLASS = "min-w-[44px] max-w-[44px] w-[44px]";

export function DispatchMatrix({ data, locale }: DispatchMatrixProps) {
  const { shippers, markets, cells, rowTotals, colTotals, grandTotal } = data;
  const colSpan = markets.length + 2;

  return (
    <ScrollMatrixTable heightOffset={280}>
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-haidee-border bg-haidee-surface">
              <BilingualHead
                messageKey="dispatch.matrixConsignorArea"
                locale={locale}
                className={cn(STICKY_HEAD_FIRST, "whitespace-nowrap px-3 py-3 text-left font-medium text-haidee-muted")}
              />
              {markets.map((code) => (
                <th
                  key={code}
                  className={cn(STICKY_HEAD_TOP, MARKET_COL_CLASS, "whitespace-nowrap px-1 py-2 text-center")}
                >
                  <div className="flex justify-center">
                    <DispatchMarketLabel code={code} className="font-mono" />
                  </div>
                </th>
              ))}
              <BilingualHead
                messageKey="common.total"
                locale={locale}
                className={cn(STICKY_HEAD_TOP, "whitespace-nowrap px-3 py-3 text-right font-medium text-haidee-muted")}
              />
            </tr>
            <tr className="border-b-2 border-haidee-border bg-gray-100 font-semibold">
              <th
                className={cn(STICKY_BODY_FIRST, "z-40 whitespace-nowrap bg-gray-100 px-3 py-2.5 text-left text-haidee-text")}
                style={{ top: MARKET_HEADER_ROW_TOP }}
              >
                {getMessageParts("dispatch.marketTotals", locale).local}{" "}
                <span className="text-xs font-normal text-haidee-muted">
                  {getMessageParts("dispatch.marketTotals", locale).en}
                </span>
              </th>
              {markets.map((code) => {
                const qty = colTotals[code] ?? emptyQty();
                return (
                  <th
                    key={code}
                    className={cn(STICKY_HEAD_TOP, "z-20 whitespace-nowrap bg-gray-100 px-1 py-2 text-center font-mono text-haidee-text", MARKET_COL_CLASS)}
                    style={{ top: MARKET_HEADER_ROW_TOP }}
                  >
                    <TotalsCellDisplay crate={qty.crate} box={qty.box} locale={locale} />
                  </th>
                );
              })}
              <th
                className={cn(STICKY_HEAD_TOP, "z-20 whitespace-nowrap bg-gray-100 px-3 py-2.5 text-right font-mono text-lg text-haidee-navy")}
                style={{ top: MARKET_HEADER_ROW_TOP }}
              >
                <TotalsCellDisplay
                  crate={grandTotal.crate}
                  box={grandTotal.box}
                  locale={locale}
                  align="end"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {shippers.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-3 py-10 text-center text-haidee-muted"
                >
                  {t("dispatch.noUnassignedCargo", locale)}
                </td>
              </tr>
            ) : (
              shippers.map((shipper) => {
                const row = rowTotals[shipper.id] ?? emptyQty();
                const rowLabel = cellDisplay(row.crate, row.box, locale);
                return (
                  <tr
                    key={shipper.id}
                    className="border-b border-haidee-border/60 hover:bg-haidee-surface/50"
                  >
                    <td className={cn(STICKY_BODY_FIRST, "max-md:whitespace-normal px-3 py-2.5 font-medium text-haidee-text md:whitespace-nowrap")}>
                      <MobileTruncatedName text={shipper.name} />
                    </td>
                    {markets.map((code) => {
                      const qty = cells[shipper.id]?.[code] ?? emptyQty();
                      const label = cellDisplay(qty.crate, qty.box, locale);
                      return (
                        <td
                          key={code}
                          className={cn(
                            MARKET_COL_CLASS,
                            "whitespace-nowrap px-1 py-2.5 text-center font-mono text-sm text-gray-800",
                            label && "font-semibold"
                          )}
                        >
                          {label}
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-bold text-haidee-text">
                      {rowLabel}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
    </ScrollMatrixTable>
  );
}
