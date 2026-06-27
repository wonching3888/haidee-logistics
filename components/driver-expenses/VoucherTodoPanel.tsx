"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { WideTableScrollArea } from "@/components/shared/WideTableScrollArea";
import { useT } from "@/components/shared/locale-context";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplay } from "@/lib/date-utils";
import {
  buildUnenteredTodoHref,
  buildVoucherTodoHref,
  isTodoUnsettledAlert,
  type DriverExpenseTodoItem,
} from "@/lib/driver-expense/todo-list";
import { cn } from "@/lib/utils";
import { VoucherStatusBadge } from "./VoucherStatusBadge";

interface VoucherTodoPanelProps {
  items: DriverExpenseTodoItem[];
  loading: boolean;
  hasLoaded: boolean;
  canWrite: boolean;
  isAdmin: boolean;
  pendingCount: number | null;
}

function todoStatusBadge(item: DriverExpenseTodoItem) {
  if (item.kind === "unentered") {
    return <VoucherStatusBadge status="none" />;
  }
  return <VoucherStatusBadge status={item.status} />;
}

function todoReferenceNo(item: DriverExpenseTodoItem): string {
  if (item.kind === "voucher" && item.voucherNo) return item.voucherNo;
  if (item.tripSource === "charter" && item.charterNo) return item.charterNo;
  return item.dispatchNo ?? "—";
}

function buildTodoHref(item: DriverExpenseTodoItem): string {
  if (item.kind === "unentered") return buildUnenteredTodoHref(item);
  return buildVoucherTodoHref(item);
}

function todoActionLabel(
  item: DriverExpenseTodoItem,
  canWrite: boolean,
  isAdmin: boolean,
  t: (key: import("@/lib/i18n/messages").MessageKey) => string
): string {
  if (item.kind === "unentered") {
    return canWrite ? t("driverExpenses.action.enter") : t("driverExpenses.action.view");
  }
  if (item.status === "pending_review" && isAdmin) {
    return t("driverExpenses.action.review");
  }
  if (item.status === "clerk_entered" || item.status === "rejected") {
    return canWrite
      ? t("driverExpenses.action.continue")
      : t("driverExpenses.action.view");
  }
  return t("driverExpenses.action.view");
}

export function VoucherTodoPanel({
  items,
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
      ) : !hasLoaded ? null : items.length === 0 ? (
        <p className="text-sm text-haidee-muted">
          {t("driverExpenses.empty.noTodo")}
        </p>
      ) : (
        <WideTableScrollArea heightOffset={420}>
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead>{t("driverExpenses.col.date")}</TableHead>
                <TableHead>{t("driverExpenses.col.referenceNo")}</TableHead>
                <TableHead>{t("driverExpenses.col.plate")}</TableHead>
                <TableHead>{t("driverExpenses.col.driver")}</TableHead>
                <TableHead>{t("driverExpenses.col.route")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="w-28">{t("common.actions")}</TableHead>
                <TableHead>{t("driverExpenses.col.unsettledDays")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={`${item.kind}-${item.tripId}`}>
                  <TableCell>{formatDisplay(item.tripDate)}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {todoReferenceNo(item)}
                  </TableCell>
                  <TableCell>{item.lorry}</TableCell>
                  <TableCell>{item.driverName || "—"}</TableCell>
                  <TableCell>{item.route}</TableCell>
                  <TableCell>{todoStatusBadge(item)}</TableCell>
                  <TableCell>
                    <Link
                      href={buildTodoHref(item)}
                      className="inline-flex h-8 items-center rounded-lg border border-input px-2.5 text-sm hover:bg-accent"
                    >
                      {todoActionLabel(item, canWrite, isAdmin, t)}
                    </Link>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-sm",
                      isTodoUnsettledAlert(item.unsettledDays) &&
                        "font-medium text-destructive"
                    )}
                  >
                    {t("driverExpenses.todo.unsettledDays", {
                      days: String(item.unsettledDays),
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
        </WideTableScrollArea>
      )}
    </div>
  );
}
