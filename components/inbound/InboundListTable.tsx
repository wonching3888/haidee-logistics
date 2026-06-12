import type { CSSProperties } from "react";
import Link from "next/link";
import { InboundDeleteButton } from "@/components/inbound/InboundDeleteButton";
import { formatCrateBoxQty } from "@/lib/consignor-label";
import { formatDisplayDate } from "@/lib/date-utils";
import { Badge } from "@/components/ui/badge";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SessionRow {
  id: string;
  sessionNo: string | null;
  date: Date;
  status: string;
  shipperName: string;
  areaNote: string | null;
  thVehiclePlate: string | null;
  totalQty: number;
  crateQty: number;
  boxQty: number;
  unassignedQty: number;
  unassignedCrateQty: number;
  unassignedBoxQty: number;
}

interface InboundListTableProps {
  sessions: SessionRow[];
}

const tableScrollStyle: CSSProperties = {
  overflow: "auto",
  WebkitOverflowScrolling: "touch",
  width: "100%",
  maxWidth: "100%",
  height: "100%",
  minHeight: 0,
};

const tableStyle: CSSProperties = {
  minWidth: "max-content",
  width: "100%",
};

const stickyHeadClass =
  "sticky top-0 z-10 border-b border-haidee-border bg-haidee-surface";

export function InboundListTable({ sessions }: InboundListTableProps) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-haidee-border bg-white p-12 text-center text-haidee-muted">
        暂无进货记录 No inbound records found
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col rounded-xl border border-haidee-border bg-white"
      style={{ width: "100%", maxWidth: "100%" }}
    >
      <div data-inbound-table-scroll style={tableScrollStyle}>
        <table style={tableStyle} className="text-sm">
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <TableHead className={stickyHeadClass}>日期 Date</TableHead>
              <TableHead className={stickyHeadClass}>批次号 Batch No.</TableHead>
              <TableHead className={stickyHeadClass}>寄货人 Consignor</TableHead>
              <TableHead className={stickyHeadClass}>地区 Area</TableHead>
              <TableHead className={stickyHeadClass}>泰国车牌 TH Plate</TableHead>
              <TableHead className={`${stickyHeadClass} text-right`}>
                总数量 Total
              </TableHead>
              <TableHead className={`${stickyHeadClass} text-right`}>
                未分配 Unassigned
              </TableHead>
              <TableHead className={stickyHeadClass}>状态 Status</TableHead>
              <TableHead className={`${stickyHeadClass} text-right`}>
                操作 Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono">
                  {formatDisplayDate(new Date(s.date))}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {s.sessionNo ?? (
                    <span className="text-haidee-muted">草稿 Draft</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">{s.shipperName}</TableCell>
                <TableCell className="font-mono text-haidee-muted">
                  {s.areaNote?.trim() || "—"}
                </TableCell>
                <TableCell className="font-mono text-haidee-muted">
                  {s.thVehiclePlate ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatCrateBoxQty(s.crateQty, s.boxQty)}
                </TableCell>
                <TableCell className="text-right font-mono">
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
                      {formatCrateBoxQty(
                        s.unassignedCrateQty,
                        s.unassignedBoxQty
                      )}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {s.status === "draft" ? (
                    <Badge variant="outline" className="border-haidee-orange text-haidee-orange">
                      草稿 Draft
                    </Badge>
                  ) : s.unassignedQty > 0 ? (
                    <Badge variant="outline" className="border-haidee-orange text-haidee-orange">
                      未分配 Unassigned
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-haidee-green text-haidee-green">
                      已分配 Assigned
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/inbound/${s.id}/edit`}
                      className="inline-flex min-h-[36px] items-center rounded-lg border border-haidee-border px-3 text-sm text-haidee-text transition-colors hover:bg-haidee-surface"
                    >
                      编辑 Edit
                    </Link>
                    <InboundDeleteButton sessionId={s.id} variant="icon" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
