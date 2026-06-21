import type { CSSProperties } from "react";
import Link from "next/link";
import { InboundDeleteButton } from "@/components/inbound/InboundDeleteButton";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { formatCrateBoxQty } from "@/lib/consignor-label";
import { formatDisplayDate } from "@/lib/date-utils";
import type { InboundSessionListRow } from "@/lib/inbound-list";
import {
  INBOUND_ACTIONS_COL,
  INBOUND_AREA_COL,
  INBOUND_BATCH_COL,
  INBOUND_CONSIGNOR_COL,
  INBOUND_DATE_COL,
  INBOUND_TH_PLATE_COL,
  STICKY_BODY_ACTIONS,
  STICKY_BODY_BATCH,
  STICKY_BODY_CONSIGNOR,
  STICKY_BODY_FIRST,
  STICKY_HEAD_ACTIONS,
  STICKY_HEAD_BATCH,
  STICKY_HEAD_CONSIGNOR,
  STICKY_HEAD_FIRST,
  STICKY_HEAD_TOP,
  stickyRowHoverBodyClass,
} from "@/lib/table-scroll";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface InboundListTableProps {
  sessions: InboundSessionListRow[];
}

/** Fixed leading columns + scrollable middle; min-width keeps horizontal scroll for wide rows. */
const tableStyle: CSSProperties = {
  tableLayout: "fixed",
  minWidth: "980px",
  width: "100%",
};

const stickyHeadTopClass = cn(STICKY_HEAD_TOP, "border-b border-haidee-border");

function safeDisplayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDisplayDate(date);
}

function TruncatedCell({
  text,
  widthClass,
  className,
}: {
  text: string | null | undefined;
  widthClass?: string;
  className?: string;
}) {
  const display = text?.trim() || "—";
  return (
    <div
      className={cn(widthClass, "truncate", className)}
      title={display !== "—" ? display : undefined}
    >
      {display}
    </div>
  );
}

function NarrowHeader({
  primary,
  secondary,
  className,
}: {
  primary: string;
  secondary: string;
  className?: string;
}) {
  return (
    <th className={className}>
      <div className="leading-tight">{primary}</div>
      <div className="text-[10px] font-normal leading-tight text-haidee-muted/90">
        {secondary}
      </div>
    </th>
  );
}

export function InboundListTable({ sessions }: InboundListTableProps) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-haidee-border bg-white p-12 text-center text-haidee-muted">
        暂无进货记录 No inbound records found
      </div>
    );
  }

  return (
    <ScrollMatrixTable fillParent className="h-full rounded-xl">
      <table data-inbound-table-scroll style={tableStyle} className="text-sm">
        <colgroup>
          <col style={{ width: 92 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 150 }} />
          <col />
          <col style={{ width: 72 }} />
          <col style={{ width: 88 }} />
          <col style={{ width: 88 }} />
          <col style={{ width: 88 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 132 }} />
        </colgroup>
        <thead>
          <tr className="border-b border-haidee-border bg-haidee-surface text-left text-haidee-muted">
            <th
              className={cn(
                STICKY_HEAD_FIRST,
                INBOUND_DATE_COL,
                "overflow-hidden whitespace-nowrap border-b border-haidee-border px-3 py-3 font-medium"
              )}
            >
              日期 Date
            </th>
            <th
              className={cn(
                STICKY_HEAD_BATCH,
                INBOUND_BATCH_COL,
                "overflow-hidden whitespace-nowrap border-b border-haidee-border px-3 py-3 font-medium"
              )}
            >
              批次号 Batch
            </th>
            <th
              className={cn(
                STICKY_HEAD_CONSIGNOR,
                INBOUND_CONSIGNOR_COL,
                "overflow-hidden border-b border-haidee-border px-3 py-3 font-medium"
              )}
            >
              <div className="leading-tight">寄货人</div>
              <div className="text-[10px] font-normal leading-tight text-haidee-muted/90">
                Consignor
              </div>
            </th>
            <th className={cn(stickyHeadTopClass, "whitespace-nowrap px-3 py-3 font-medium")}>
              收货地点 Pickup
            </th>
            <NarrowHeader
              primary="地区"
              secondary="Area"
              className={cn(
                stickyHeadTopClass,
                INBOUND_AREA_COL,
                "overflow-hidden px-2 py-3 font-medium"
              )}
            />
            <NarrowHeader
              primary="车牌"
              secondary="TH Plt"
              className={cn(
                stickyHeadTopClass,
                INBOUND_TH_PLATE_COL,
                "overflow-hidden px-2 py-3 font-medium"
              )}
            />
            <th
              className={cn(
                stickyHeadTopClass,
                "whitespace-nowrap px-3 py-3 text-right font-medium"
              )}
            >
              总数量 Total
            </th>
            <th
              className={cn(
                stickyHeadTopClass,
                "whitespace-nowrap px-3 py-3 text-right font-medium"
              )}
            >
              未分配 Unassigned
            </th>
            <th className={cn(stickyHeadTopClass, "whitespace-nowrap px-3 py-3 font-medium")}>
              状态 Status
            </th>
            <th
              className={cn(
                STICKY_HEAD_ACTIONS,
                INBOUND_ACTIONS_COL,
                "overflow-hidden whitespace-nowrap border-b border-haidee-border px-3 py-3 text-right font-medium"
              )}
            >
              操作 Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr
              key={s.id}
              className="group border-b border-haidee-border hover:bg-haidee-surface/50"
            >
              <td
                className={cn(
                  STICKY_BODY_FIRST,
                  stickyRowHoverBodyClass,
                  INBOUND_DATE_COL,
                  "overflow-hidden whitespace-nowrap px-3 py-2 font-mono"
                )}
              >
                {safeDisplayDate(s.date)}
              </td>
              <td
                className={cn(
                  STICKY_BODY_BATCH,
                  stickyRowHoverBodyClass,
                  INBOUND_BATCH_COL,
                  "overflow-hidden px-3 py-2 font-mono text-sm"
                )}
              >
                <div
                  className="w-[100px] truncate"
                  title={s.sessionNo ?? undefined}
                >
                  {s.sessionNo ?? (
                    <span className="text-haidee-muted">草稿 Draft</span>
                  )}
                </div>
              </td>
              <td
                className={cn(
                  STICKY_BODY_CONSIGNOR,
                  stickyRowHoverBodyClass,
                  INBOUND_CONSIGNOR_COL,
                  "overflow-hidden px-3 py-2 font-medium"
                )}
              >
                <div className="w-[150px] truncate" title={s.shipperName}>
                  {s.shipperName}
                </div>
              </td>
              <td className="overflow-hidden whitespace-nowrap px-3 py-2 text-sm text-haidee-text">
                {s.pickupLocationLabel}
              </td>
              <td className={cn(INBOUND_AREA_COL, "overflow-hidden px-2 py-2 font-mono text-haidee-muted")}>
                <TruncatedCell text={s.areaNote} widthClass="w-[72px]" />
              </td>
              <td className={cn(INBOUND_TH_PLATE_COL, "overflow-hidden px-2 py-2 font-mono text-haidee-muted")}>
                <TruncatedCell text={s.thVehiclePlate} widthClass="w-[88px]" />
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-semibold">
                {formatCrateBoxQty(s.crateQty, s.boxQty)}
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
                    {formatCrateBoxQty(s.unassignedCrateQty, s.unassignedBoxQty)}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {s.status === "draft" ? (
                  <Badge
                    variant="outline"
                    className="border-haidee-orange text-haidee-orange"
                  >
                    草稿 Draft
                  </Badge>
                ) : s.unassignedQty > 0 ? (
                  <Badge
                    variant="outline"
                    className="border-haidee-orange text-haidee-orange"
                  >
                    未分配 Unassigned
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-haidee-green text-haidee-green"
                  >
                    已分配 Assigned
                  </Badge>
                )}
              </td>
              <td
                className={cn(
                  STICKY_BODY_ACTIONS,
                  stickyRowHoverBodyClass,
                  INBOUND_ACTIONS_COL,
                  "overflow-hidden whitespace-nowrap px-3 py-2 text-right"
                )}
              >
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`/inbound/${s.id}/edit`}
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-haidee-blue px-3 text-sm text-haidee-blue transition-colors hover:bg-haidee-blue/10"
                  >
                    编辑 Edit
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
