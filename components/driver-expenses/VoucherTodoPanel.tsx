"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { useT } from "@/components/shared/locale-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplay } from "@/lib/date-utils";
import type { DriverVoucherListItem } from "@/lib/driver-expense/voucher-list-types";
import { VoucherStatusBadge } from "./VoucherStatusBadge";

interface VoucherTodoPanelProps {
  vouchers: DriverVoucherListItem[];
  loading: boolean;
  hasLoaded: boolean;
  canWrite: boolean;
  isAdmin: boolean;
  pendingCount: number | null;
}

function buildTodoHref(v: DriverVoucherListItem): string {
  return `/documents/driver-expenses/${v.id}?date=${v.tripDate}`;
}

function todoActionLabel(
  v: DriverVoucherListItem,
  canWrite: boolean,
  isAdmin: boolean,
  t: (key: import("@/lib/i18n/messages").MessageKey) => string
): string {
  if (v.status === "pending_review" && isAdmin) {
    return t("driverExpenses.action.review");
  }
  if ((v.status === "draft" || v.status === "rejected") && canWrite) {
    return t("driverExpenses.action.continue");
  }
  return t("driverExpenses.action.view");
}

export function VoucherTodoPanel({
  vouchers,
  loading,
  hasLoaded,
  canWrite,
  isAdmin,
  pendingCount,
}: VoucherTodoPanelProps) {
  const { t } = useT();

  return (
    <div className="space-y-4">
      {isAdmin && pendingCount != null && (
        <p className="text-sm font-medium text-orange-800">
          {t("driverExpenses.pendingReviewCount", {
            count: String(pendingCount),
          })}
        </p>
      )}

      {!hasLoaded && loading ? (
        <p className="flex items-center gap-2 text-sm text-haidee-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("driverExpenses.loading")}
        </p>
      ) : !hasLoaded ? null : vouchers.length === 0 ? (
        <p className="text-sm text-haidee-muted">
          {t("driverExpenses.empty.noTodo")}
        </p>
      ) : (
        <ScrollMatrixTable heightOffset={420}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("driverExpenses.col.date")}</TableHead>
                <TableHead>{t("driverExpenses.col.plate")}</TableHead>
                <TableHead>{t("driverExpenses.col.driver")}</TableHead>
                <TableHead>{t("driverExpenses.col.route")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="w-28">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vouchers.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{formatDisplay(v.tripDate)}</TableCell>
                  <TableCell>{v.lorry}</TableCell>
                  <TableCell>{v.driverName}</TableCell>
                  <TableCell>{v.route}</TableCell>
                  <TableCell>
                    <VoucherStatusBadge status={v.status} />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={buildTodoHref(v)}
                      className="inline-flex h-8 items-center rounded-lg border border-input px-2.5 text-sm hover:bg-accent"
                    >
                      {todoActionLabel(v, canWrite, isAdmin, t)}
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
