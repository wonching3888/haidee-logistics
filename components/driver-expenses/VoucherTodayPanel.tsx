"use client";

import Link from "next/link";
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
import type { ExpenseTripRow } from "@/lib/driver-expense/voucher-list-types";
import { VoucherStatusBadge } from "./VoucherStatusBadge";

interface VoucherTodayPanelProps {
  date: string;
  trips: ExpenseTripRow[];
  hasLoaded: boolean;
  canWrite: boolean;
  isAdmin: boolean;
}

function tripActionHref(row: ExpenseTripRow, date: string): string {
  if (!row.voucherId) {
    const params = new URLSearchParams({ date, tripId: row.tripId });
    if (row.tripSource === "charter") params.set("tripSource", "charter");
    return `/documents/driver-expenses/new?${params.toString()}`;
  }
  return `/documents/driver-expenses/${row.voucherId}?date=${date}`;
}

function tripActionLabel(
  row: ExpenseTripRow,
  canWrite: boolean,
  isAdmin: boolean,
  t: (key: import("@/lib/i18n/messages").MessageKey) => string
): string | null {
  if (row.status === "none") {
    return canWrite ? t("driverExpenses.action.enter") : null;
  }
  if (row.status === "draft" || row.status === "rejected") {
    return canWrite ? t("driverExpenses.action.continue") : t("driverExpenses.action.view");
  }
  if (row.status === "pending_review" && isAdmin) {
    return t("driverExpenses.action.review");
  }
  return t("driverExpenses.action.view");
}

export function VoucherTodayPanel({
  date,
  trips,
  hasLoaded,
  canWrite,
  isAdmin,
}: VoucherTodayPanelProps) {
  const { t } = useT();

  return (
    <div className="space-y-4">
      {!hasLoaded ? (
        <p className="text-sm text-haidee-muted">
          {t("driverExpenses.empty.queryFirst")}
        </p>
      ) : trips.length === 0 ? (
        <p className="text-sm text-haidee-muted">
          {t("driverExpenses.empty.noDispatch")}
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
              {trips.map((row) => {
                const actionLabel = tripActionLabel(row, canWrite, isAdmin, t);
                return (
                  <TableRow key={`${row.tripSource}:${row.tripId}`}>
                    <TableCell>{formatDisplay(row.tripDate)}</TableCell>
                    <TableCell>{row.lorry}</TableCell>
                    <TableCell>{row.driverName}</TableCell>
                    <TableCell>
                      <span>{row.route}</span>
                      {row.tripSource === "charter" && (
                        <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-800">
                          包车
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <VoucherStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      {actionLabel ? (
                        <Link
                          href={tripActionHref(row, date)}
                          className="inline-flex h-8 items-center rounded-lg border border-input px-2.5 text-sm hover:bg-accent"
                        >
                          {actionLabel}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollMatrixTable>
      )}
    </div>
  );
}
