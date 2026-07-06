"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DateInputField } from "@/components/shared/DateInputField";
import { MobileTruncatedName } from "@/components/shared/MobileTruncatedName";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { stickyFirstColTableClass } from "@/lib/table-scroll";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight } from "lucide-react";
import type { AuditFeedEntry } from "@/lib/audit-feed";
import type { HistoryTab } from "@/lib/audit-feed";

const TABS: { id: HistoryTab; label: string }[] = [
  { id: "all", label: "全部 All" },
  { id: "inbound", label: "进货 Inbound" },
  { id: "payroll", label: "工资 Payroll" },
  { id: "voucher", label: "费用单 Voucher" },
  { id: "trips", label: "派车/包车 Trips" },
  { id: "invoice_collections", label: "收账 Collections" },
  { id: "crate", label: "桶管理 Crate" },
];

const ENTITY_TYPE_LABELS: Record<AuditFeedEntry["entityType"], string> = {
  inbound: "进货",
  payroll: "工资",
  voucher: "费用单",
  dispatch: "派车",
  charter: "包车",
  invoice_payment: "收账",
  crate: "桶管理",
};

interface HistoryViewProps {
  records: AuditFeedEntry[];
  filterDate: string;
  activeTab: HistoryTab;
}

export function HistoryView({ records, filterDate, activeTab }: HistoryViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function pushParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`/history?${params.toString()}`);
  }

  const showInboundColumns = activeTab === "all" || activeTab === "inbound";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-haidee-border pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => pushParams({ tab: tab.id === "all" ? undefined : tab.id })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-haidee-blue text-white"
                : "bg-haidee-surface text-haidee-text hover:bg-haidee-border/40"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-haidee-text">
            筛选日期 Filter Date
          </label>
          <DateInputField
            value={filterDate}
            onChange={(next) => {
              pushParams({ date: next || undefined });
            }}
          />
        </div>
        {filterDate && (
          <button
            type="button"
            onClick={() => pushParams({ date: undefined })}
            className="text-sm text-haidee-blue hover:underline"
          >
            清除筛选 Clear filter
          </button>
        )}
      </div>

      <ScrollMatrixTable heightOffset={380} className="rounded-xl">
        {records.length === 0 ? (
          <p className="p-8 text-center text-haidee-muted">
            暂无修改记录 No modification records
          </p>
        ) : (
          <Table noScrollContainer className={`min-w-[1400px] ${stickyFirstColTableClass}`}>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                {activeTab === "all" && <TableHead>类型 Type</TableHead>}
                <TableHead>对象 Entity</TableHead>
                {showInboundColumns && activeTab === "inbound" && (
                  <>
                    <TableHead>进货单号 Session</TableHead>
                    <TableHead>日期 Date</TableHead>
                    <TableHead>寄货人 Consignor</TableHead>
                    <TableHead>收货地点 Pickup</TableHead>
                  </>
                )}
                <TableHead>事件 Event</TableHead>
                <TableHead>修改时间 Modified</TableHead>
                <TableHead>修改人 Modified By</TableHead>
                <TableHead>变更内容 Changes</TableHead>
                <TableHead className="w-16">链接</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((rec) => (
                <TableRow key={`${rec.entityType}-${rec.id}`}>
                  {activeTab === "all" && (
                    <TableCell className="text-sm">
                      {ENTITY_TYPE_LABELS[rec.entityType]}
                    </TableCell>
                  )}
                  <TableCell className="text-sm">
                    <MobileTruncatedName text={rec.entityLabel} />
                  </TableCell>
                  {showInboundColumns && activeTab === "inbound" && (
                    <>
                      <TableCell>
                        {rec.sessionNo ? (
                          <span className="font-mono text-sm">{rec.sessionNo}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {rec.sessionDate ?? "—"}
                      </TableCell>
                      <TableCell>
                        {rec.shipperName ? (
                          <MobileTruncatedName text={rec.shipperName} />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {rec.pickupLocationLabel ?? "—"}
                      </TableCell>
                    </>
                  )}
                  <TableCell className="text-sm text-haidee-muted">
                    {rec.eventTypeLabel}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-haidee-muted">
                    {rec.occurredAtDisplay}
                  </TableCell>
                  <TableCell className="text-sm">{rec.actorName}</TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      {rec.changes.map((c, i) => (
                        <div key={i} className="text-sm">
                          <span className="text-haidee-muted">{c.field}:</span>{" "}
                          <span className="font-mono text-haidee-red line-through">
                            {c.from}
                          </span>
                          <ArrowRight className="mx-1 inline h-3 w-3 text-haidee-muted" />
                          <span className="font-mono font-semibold text-haidee-green">
                            {c.to}
                          </span>
                        </div>
                      ))}
                      {rec.changes.length === 0 && (
                        <span className="text-haidee-muted">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {rec.deepLink ? (
                      <Link
                        href={rec.deepLink}
                        className="text-sm text-haidee-blue hover:underline"
                      >
                        查看
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ScrollMatrixTable>

      <p className="text-xs text-haidee-muted">
        汇总进货、工资、费用单、派车/包车、收账与桶管理的人工修改记录，按时间倒序混排。
      </p>
    </div>
  );
}
