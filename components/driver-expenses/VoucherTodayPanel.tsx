"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMyr } from "@/lib/driver-expense/voucher-utils";
import type { DriverVoucherListItem } from "@/lib/driver-expense/voucher-list-types";
import { cn } from "@/lib/utils";
import { VoucherStatusBadge } from "./VoucherStatusBadge";

interface VoucherTodayPanelProps {
  date: string;
  vouchers: DriverVoucherListItem[];
  hasLoaded: boolean;
  canCreate: boolean;
}

export function VoucherTodayPanel({
  date,
  vouchers,
  hasLoaded,
  canCreate,
}: VoucherTodayPanelProps) {
  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="no-print">
          <Link
            href={`/documents/driver-expenses/new?date=${date}&tab=today`}
            className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            新增 Add New
          </Link>
        </div>
      )}

      {!hasLoaded ? (
        <p className="text-sm text-haidee-muted">
          请选择日期后点击「查询」加载当日报销单
        </p>
      ) : vouchers.length === 0 ? (
        <p className="text-sm text-haidee-muted">此日期暂无报销单</p>
      ) : (
        <ScrollMatrixTable heightOffset={320}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>单号</TableHead>
                <TableHead>罗里</TableHead>
                <TableHead>司机</TableHead>
                <TableHead>路线</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">路费</TableHead>
                <TableHead className="text-right">支出</TableHead>
                <TableHead className="text-right">余额</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {vouchers.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-sm">{v.voucherNo}</TableCell>
                  <TableCell>{v.lorry}</TableCell>
                  <TableCell>{v.driverName}</TableCell>
                  <TableCell>{v.route}</TableCell>
                  <TableCell>
                    <VoucherStatusBadge status={v.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {v.duitJalan != null ? formatMyr(v.duitJalan) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {v.belanja != null ? formatMyr(v.belanja) : "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono font-medium",
                      v.baki != null && v.baki >= 0 && "text-green-600",
                      v.baki != null && v.baki < 0 && "text-red-600"
                    )}
                  >
                    {v.baki != null ? formatMyr(v.baki) : "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/documents/driver-expenses/${v.id}?date=${date}&tab=today`}
                      className="inline-flex h-8 items-center rounded-lg border border-input px-2.5 text-sm hover:bg-accent"
                    >
                      查看
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollMatrixTable>
      )}
    </div>
  );
}
