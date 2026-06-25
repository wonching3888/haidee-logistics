export const VOUCHER_STATUSES = [
  "draft",
  "clerk_entered",
  "confirmed",
  "pending_review",
  "approved",
  "rejected",
] as const;

export type VoucherStatus = (typeof VOUCHER_STATUSES)[number];

export function isVoucherStatus(value: string): value is VoucherStatus {
  return (VOUCHER_STATUSES as readonly string[]).includes(value);
}

export const VOUCHER_STATUS_LABELS: Record<VoucherStatus, string> = {
  draft: "估算",
  clerk_entered: "已录待确认",
  confirmed: "已确认",
  pending_review: "待审核",
  approved: "已审",
  rejected: "已打回",
};
