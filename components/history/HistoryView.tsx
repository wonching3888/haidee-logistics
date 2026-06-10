"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight } from "lucide-react";

interface ModificationRecord {
  id: string;
  sessionNo: string | null;
  sessionDate: string;
  shipperName: string;
  modifiedAt: string;
  changes: { field: string; from: string; to: string }[];
}

interface HistoryViewProps {
  records: ModificationRecord[];
  filterDate: string;
}

export function HistoryView({ records, filterDate }: HistoryViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-haidee-text">
            筛选日期 Filter Date
          </label>
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams.toString());
              if (e.target.value) params.set("date", e.target.value);
              else params.delete("date");
              router.push(`/history?${params.toString()}`);
            }}
            className="min-h-[44px] w-auto"
          />
        </div>
        {filterDate && (
          <button
            type="button"
            onClick={() => router.push("/history")}
            className="text-sm text-haidee-blue hover:underline"
          >
            清除筛选 Clear filter
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
        {records.length === 0 ? (
          <p className="p-8 text-center text-haidee-muted">
            暂无修改记录 No modification records
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead>进货单号 Session</TableHead>
                <TableHead>日期 Date</TableHead>
                <TableHead>寄货人 Consignor</TableHead>
                <TableHead>修改时间 Modified</TableHead>
                <TableHead>变更内容 Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((rec) => (
                <TableRow key={rec.id}>
                  <TableCell>
                    {rec.sessionNo ? (
                      <span className="font-mono text-sm">{rec.sessionNo}</span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {rec.sessionDate}
                  </TableCell>
                  <TableCell>{rec.shipperName}</TableCell>
                  <TableCell className="font-mono text-sm text-haidee-muted">
                    {rec.modifiedAt}
                  </TableCell>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <p className="text-xs text-haidee-muted">
        仅显示已修改的进货明细行。编辑进货单后，原始值会自动保留。
        <Link href="/inbound" className="ml-1 text-haidee-blue hover:underline">
          前往进货录入 →
        </Link>
      </p>
    </div>
  );
}
