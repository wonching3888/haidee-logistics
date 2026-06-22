import type { CSSProperties } from "react";
import Link from "next/link";
import { InboundDeleteButton } from "@/components/inbound/InboundDeleteButton";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { formatCrateBoxQty } from "@/lib/consignor-label";
import { formatDisplayDate } from "@/lib/date-utils";
import { getMessageParts, t } from "@/lib/i18n/translate";
import type { MessageKey } from "@/lib/i18n/messages";
import type { InboundSessionListRow } from "@/lib/inbound-list";
import {
  INBOUND_COLUMN_WIDTHS,
  INBOUND_STICKY_LEFT_PX,
  INBOUND_TABLE_MIN_WIDTH_PX,
  STICKY_BODY_BATCH,
  STICKY_BODY_CONSIGNOR,
  STICKY_BODY_FIRST,
  STICKY_HEAD_BATCH,
  STICKY_HEAD_CONSIGNOR,
  STICKY_HEAD_FIRST,
  STICKY_HEAD_TOP,
  stickyRowHoverBodyClass,
} from "@/lib/table-scroll";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { UserLanguage } from "@/types";

interface InboundListTableProps {
  sessions: InboundSessionListRow[];
  locale: UserLanguage;
}

const W = INBOUND_COLUMN_WIDTHS;

/** Content width inside px-3 cells (12px padding each side). */
function innerWidth(colWidth: number, px = 12): number {
  return Math.max(0, colWidth - px * 2);
}

const tableStyle: CSSProperties = {
  tableLayout: "fixed",
  width: `${INBOUND_TABLE_MIN_WIDTH_PX}px`,
  minWidth: `${INBOUND_TABLE_MIN_WIDTH_PX}px`,
};

const stickyLeft = (px: number): CSSProperties => ({ left: px });

const stickyHeadTopClass = cn(STICKY_HEAD_TOP, "border-b border-haidee-border");

function safeDisplayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDisplayDate(date);
}

function TruncatedCell({
  text,
  maxWidth,
  className,
}: {
  text: string | null | undefined;
  maxWidth: number;
  className?: string;
}) {
  const display = text?.trim() || "—";
  return (
    <div
      className={cn("truncate", className)}
      style={{ maxWidth }}
      title={display !== "—" ? display : undefined}
    >
      {display}
    </div>
  );
}

function I18nHeader({
  messageKey,
  locale,
  className,
  align = "left",
}: {
  messageKey: MessageKey;
  locale: UserLanguage;
  className?: string;
  align?: "left" | "right";
}) {
  const { local, en } = getMessageParts(messageKey, locale);
  return (
    <th
      className={cn(
        className,
        align === "right" && "text-right"
      )}
    >
      <div className="leading-tight">{local}</div>
      <div className="text-[10px] font-normal leading-tight text-haidee-muted/90">
        {en}
      </div>
    </th>
  );
}

export function InboundListTable({ sessions, locale }: InboundListTableProps) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-haidee-border bg-white p-12 text-center text-haidee-muted">
        {t("inbound.emptyList", locale)}
      </div>
    );
  }

  const draftLabel = t("common.draft", locale);
  const unassignedLabel = t("inbound.unassigned", locale);
  const assignedLabel = t("inbound.statusAssigned", locale);
  const editLabel = t("common.edit", locale);

  return (
    <ScrollMatrixTable fillParent className="h-full rounded-xl">
      <table data-inbound-table-scroll style={tableStyle} className="text-sm">
        <colgroup>
          <col style={{ width: W.date }} />
          <col style={{ width: W.batch }} />
          <col style={{ width: W.consignor }} />
          <col style={{ width: W.pickup }} />
          <col style={{ width: W.area }} />
          <col style={{ width: W.plate }} />
          <col style={{ width: W.total }} />
          <col style={{ width: W.unassigned }} />
          <col style={{ width: W.status }} />
          <col style={{ width: W.actions }} />
        </colgroup>
        <thead>
          <tr className="border-b border-haidee-border bg-haidee-surface text-left text-haidee-muted">
            <I18nHeader
              messageKey="common.date"
              locale={locale}
              className={cn(
                STICKY_HEAD_FIRST,
                "overflow-hidden whitespace-nowrap border-b border-haidee-border px-3 py-3 font-medium"
              )}
            />
            <I18nHeader
              messageKey="inbound.batchNo"
              locale={locale}
              className={cn(
                STICKY_HEAD_BATCH,
                "overflow-hidden whitespace-nowrap border-b border-haidee-border px-3 py-3 font-medium"
              )}
            />
            <I18nHeader
              messageKey="common.consignor"
              locale={locale}
              className={cn(
                STICKY_HEAD_CONSIGNOR,
                "overflow-hidden border-b border-haidee-border px-3 py-3 font-medium"
              )}
            />
            <I18nHeader
              messageKey="inbound.pickup"
              locale={locale}
              className={cn(stickyHeadTopClass, "overflow-hidden whitespace-nowrap px-3 py-3 font-medium")}
            />
            <I18nHeader
              messageKey="common.area"
              locale={locale}
              className={cn(stickyHeadTopClass, "overflow-hidden px-2 py-3 font-medium")}
            />
            <I18nHeader
              messageKey="inbound.thPlate"
              locale={locale}
              className={cn(stickyHeadTopClass, "overflow-hidden px-2 py-3 font-medium")}
            />
            <I18nHeader
              messageKey="common.total"
              locale={locale}
              align="right"
              className={cn(
                stickyHeadTopClass,
                "whitespace-nowrap px-3 py-3 font-medium"
              )}
            />
            <I18nHeader
              messageKey="inbound.unassigned"
              locale={locale}
              align="right"
              className={cn(
                stickyHeadTopClass,
                "whitespace-nowrap px-3 py-3 font-medium"
              )}
            />
            <I18nHeader
              messageKey="common.status"
              locale={locale}
              className={cn(stickyHeadTopClass, "overflow-hidden whitespace-nowrap px-3 py-3 font-medium")}
            />
            <I18nHeader
              messageKey="common.actions"
              locale={locale}
              align="right"
              className={cn(stickyHeadTopClass, "overflow-hidden whitespace-nowrap px-3 py-3 font-medium")}
            />
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr
              key={s.id}
              className="group border-b border-haidee-border hover:bg-haidee-surface/50"
            >
              <td
                style={stickyLeft(INBOUND_STICKY_LEFT_PX.date)}
                className={cn(
                  STICKY_BODY_FIRST,
                  stickyRowHoverBodyClass,
                  "overflow-hidden whitespace-nowrap px-3 py-2 font-mono"
                )}
              >
                {safeDisplayDate(s.date)}
              </td>
              <td
                style={stickyLeft(INBOUND_STICKY_LEFT_PX.batch)}
                className={cn(
                  STICKY_BODY_BATCH,
                  stickyRowHoverBodyClass,
                  "overflow-hidden px-3 py-2 font-mono text-sm"
                )}
              >
                <div
                  className="whitespace-nowrap"
                  title={s.sessionNo ?? undefined}
                >
                  {s.sessionNo ?? (
                    <span className="text-haidee-muted">{draftLabel}</span>
                  )}
                </div>
              </td>
              <td
                style={stickyLeft(INBOUND_STICKY_LEFT_PX.consignor)}
                className={cn(
                  STICKY_BODY_CONSIGNOR,
                  stickyRowHoverBodyClass,
                  "overflow-hidden px-3 py-2 font-medium"
                )}
              >
                <div
                  className="truncate"
                  style={{ maxWidth: innerWidth(W.consignor) }}
                  title={s.shipperName}
                >
                  {s.shipperName}
                </div>
              </td>
              <td className="overflow-hidden px-3 py-2 text-sm text-haidee-text">
                <div
                  className="truncate"
                  style={{ maxWidth: innerWidth(W.pickup) }}
                  title={s.pickupLocationLabel}
                >
                  {s.pickupLocationLabel}
                </div>
              </td>
              <td className="overflow-hidden px-2 py-2 font-mono text-haidee-muted">
                <TruncatedCell text={s.areaNote} maxWidth={innerWidth(W.area, 8)} />
              </td>
              <td className="overflow-hidden px-2 py-2 font-mono text-haidee-muted">
                <TruncatedCell text={s.thVehiclePlate} maxWidth={innerWidth(W.plate, 8)} />
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-semibold">
                {formatCrateBoxQty(s.crateQty, s.boxQty, locale)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-mono">
                {s.status === "draft" ? (
                  "—"
                ) : (
                  <span
                    className={
                      s.unassignedQty > 0
                        ? "font-semibold text-haidee-orange"
                        : "text-haidee-green"
                    }
                  >
                    {formatCrateBoxQty(s.unassignedCrateQty, s.unassignedBoxQty, locale)}
                  </span>
                )}
              </td>
              <td className="overflow-hidden whitespace-nowrap px-3 py-2">
                {s.status === "draft" ? (
                  <Badge
                    variant="outline"
                    className="max-w-full truncate border-haidee-orange text-xs text-haidee-orange"
                    title={draftLabel}
                  >
                    {draftLabel}
                  </Badge>
                ) : s.unassignedQty > 0 ? (
                  <Badge
                    variant="outline"
                    className="max-w-full truncate border-haidee-orange text-xs text-haidee-orange"
                    title={unassignedLabel}
                  >
                    {unassignedLabel}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="max-w-full truncate border-haidee-green text-xs text-haidee-green"
                    title={assignedLabel}
                  >
                    {assignedLabel}
                  </Badge>
                )}
              </td>
              <td className="overflow-hidden whitespace-nowrap px-3 py-2 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`/inbound/${s.id}/edit`}
                    className="inline-flex min-h-[36px] shrink-0 items-center rounded-lg border border-haidee-blue px-3 text-sm text-haidee-blue transition-colors hover:bg-haidee-blue/10"
                  >
                    {editLabel}
                  </Link>
                  <InboundDeleteButton sessionId={s.id} variant="icon" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollMatrixTable>
  );
}
