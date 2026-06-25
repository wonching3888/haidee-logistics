"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/shared/locale-context";
import { cn } from "@/lib/utils";
import type { VoucherStatus } from "@/lib/driver-voucher-status-types";
import { isVoucherStatus } from "@/lib/driver-voucher-status-types";
import type { MessageKey } from "@/lib/i18n/messages";

const STATUS_CLASS: Record<VoucherStatus | "none", string> = {
  none: "bg-slate-50 text-slate-500 border-slate-200",
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  clerk_entered: "bg-blue-100 text-blue-800 border-blue-200",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  pending_review: "bg-orange-100 text-orange-900 border-orange-200",
  approved: "bg-emerald-200 text-emerald-950 border-emerald-300",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_LABEL_KEYS: Record<VoucherStatus | "none", MessageKey> = {
  none: "driverExpenses.status.notEntered",
  draft: "driverExpenses.status.draft",
  clerk_entered: "driverExpenses.status.clerk_entered",
  confirmed: "driverExpenses.status.confirmed",
  pending_review: "driverExpenses.status.pending_review",
  approved: "driverExpenses.status.approved",
  rejected: "driverExpenses.status.rejected",
};

export function VoucherStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const { t } = useT();
  const key: VoucherStatus | "none" =
    status === "none"
      ? "none"
      : isVoucherStatus(status)
        ? status
        : "draft";

  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap font-normal",
        STATUS_CLASS[key],
        className
      )}
    >
      {t(STATUS_LABEL_KEYS[key])}
    </Badge>
  );
}
