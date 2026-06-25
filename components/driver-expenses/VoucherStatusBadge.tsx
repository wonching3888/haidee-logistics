import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VoucherStatus } from "@/lib/driver-voucher-status-types";
import {
  isVoucherStatus,
  VOUCHER_STATUS_LABELS,
} from "@/lib/driver-voucher-status-types";

const STATUS_CLASS: Record<VoucherStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  clerk_entered: "bg-blue-100 text-blue-800 border-blue-200",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  pending_review: "bg-orange-100 text-orange-900 border-orange-200",
  approved: "bg-emerald-200 text-emerald-950 border-emerald-300",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

export function VoucherStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const key = isVoucherStatus(status) ? status : "draft";
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap font-normal",
        STATUS_CLASS[key],
        className
      )}
    >
      {VOUCHER_STATUS_LABELS[key]}
    </Badge>
  );
}
