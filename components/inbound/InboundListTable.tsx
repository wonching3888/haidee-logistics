"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { InboundDeleteButton } from "@/components/inbound/InboundDeleteButton";
import { MobileTruncatedName } from "@/components/shared/MobileTruncatedName";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { formatCrateBoxQty } from "@/lib/consignor-label";
import { formatDisplayDate } from "@/lib/date-utils";
import {
  STICKY_BODY_FIRST,
  STICKY_HEAD_FIRST,
  STICKY_HEAD_TOP,
} from "@/lib/table-scroll";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface InboundSessionListRow {
  id: string;
  sessionNo: string | null;
  date: string;
  status: string;
  shipperName: string;
  areaNote: string | null;
  pickupLocationLabel: string;
  thVehiclePlate: string | null;
  totalQty: number;
  crateQty: number;
  boxQty: number;
  unassignedQty: number;
  unassignedCrateQty: number;
  unassignedBoxQty: number;
}

interface InboundListTableProps {
  sessions: InboundSessionListRow[];
}

const tableStyle: CSSProperties = {
  minWidth: "max-content",
  width: "100%",
};

const stickyHeadTopClass = cn(STICKY_HEAD_TOP, "border-b border-haidee-border");

function safeDisplayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDisplayDate(date);
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
    <ScrollMatrixTable heightOffset={280} className="rounded-xl">
      <table data-inbound-table-scroll style={tableStyle} className="text-sm">
        <thead>
          <tr className="border-b border-haidee-border bg-haidee-surface text-left text-haidee-muted">
            <th
              className={cn(
                STICKY_HEAD_FIRST,
                "whitespace-nowrap border-b border-haidee-border px-3 py-3 font-medium"
              )}
            >
              日期 Date
            </th>
            <th className={cn(stickyHeadTopClass, "whitespace-nowrap px-3 py-3 font-medium")}>
              批次号 Batch No.
            </th>
            <th className={cn(stickyHeadTopClass, "whitespace-nowrap px-3 py-3 font-medium")}>
              寄货人 Consignor
            </th>
            <th className={cn(stickyHeadTopClass, "whitespace-nowrap px-3 py-3 font-medium")}>
              收货地点 Pickup
            </th>
            <th className={cn(stickyHeadTopClass, "whitespace-nowrap px-3 py-3 font-medium")}>
              地区 Area
            </th>
            <th className={cn(stickyHeadTopClass, "whitespace-nowrap px-3 py-3 font-medium")}>
              泰国车牌 TH Plate
            </th>
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
                stickyHeadTopClass,
                "whitespace-nowrap px-3 py-3 text-right font-medium"
              )}
            >
              操作 Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="border-b border-haidee-border hover:bg-white/60">
              <td
                className={cn(
                  STICKY_BODY_FIRST,
                  "whitespace-nowrap px-3 py-2 font-mono"
                )}
              >
                {safeDisplayDate(s.date)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-sm">
                {s.sessionNo ?? (
                  <span className="text-haidee-muted">草稿 Draft</span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-medium">
                <MobileTruncatedName text={s.shipperName} />
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-sm text-haidee-text">
                {s.pickupLocationLabel}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-haidee-muted">
                {s.areaNote?.trim() || "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-haidee-muted">
                {s.thVehiclePlate ?? "—"}
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
              <td className="whitespace-nowrap px-3 py-2 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`/inbound/${s.id}/edit`}
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-haidee-border px-3 text-sm text-haidee-text transition-colors hover:bg-haidee-surface"
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
