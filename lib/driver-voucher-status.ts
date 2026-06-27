import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { StoredUserRole } from "@/types";
import {
  applyVoucherCostActuals,
  clearVoucherCostActuals,
} from "@/lib/driver-expense/voucher-cost-apply";
import {
  isVoucherStatus,
  type VoucherStatus,
} from "@/lib/driver-voucher-status-types";
import { isVoucherCostEnforced } from "@/lib/trip-cost-engine/config";

export {
  isVoucherStatus,
  VOUCHER_STATUSES,
  type VoucherStatus,
} from "@/lib/driver-voucher-status-types";

export interface VoucherTransitionActor {
  id: string;
  role: StoredUserRole;
}

const ALLOWED_TRANSITIONS: Record<VoucherStatus, readonly VoucherStatus[]> = {
  draft: ["clerk_entered"],
  clerk_entered: ["confirmed", "pending_review"],
  pending_review: ["approved", "rejected"],
  rejected: ["clerk_entered"],
  confirmed: [],
  approved: [],
};

const ADMIN_ONLY_TARGET_STATUSES = new Set<VoucherStatus>([
  "approved",
  "rejected",
]);

const CLERK_TARGET_STATUSES = new Set<VoucherStatus>([
  "clerk_entered",
  "confirmed",
  "pending_review",
]);

const CLERK_ROLES = new Set<StoredUserRole>([
  "admin",
  "clerk",
  "thai_accounting",
]);

export class VoucherStatusTransitionError extends Error {
  readonly code: "NOT_FOUND" | "INVALID_TRANSITION" | "FORBIDDEN";

  constructor(
    code: "NOT_FOUND" | "INVALID_TRANSITION" | "FORBIDDEN",
    message: string
  ) {
    super(message);
    this.name = "VoucherStatusTransitionError";
    this.code = code;
  }
}

export function isVoucherTransitionAllowed(
  fromStatus: VoucherStatus,
  toStatus: VoucherStatus
): boolean {
  return ALLOWED_TRANSITIONS[fromStatus].includes(toStatus);
}

export function assertActorCanTransition(
  actor: VoucherTransitionActor,
  toStatus: VoucherStatus
): void {
  if (ADMIN_ONLY_TARGET_STATUSES.has(toStatus)) {
    if (actor.role !== "admin") {
      throw new VoucherStatusTransitionError(
        "FORBIDDEN",
        "仅 ADMIN 可审核通过或打回 / Only admin may approve or reject"
      );
    }
    return;
  }

  if (CLERK_TARGET_STATUSES.has(toStatus)) {
    if (!CLERK_ROLES.has(actor.role)) {
      throw new VoucherStatusTransitionError(
        "FORBIDDEN",
        "无权限执行此状态变更 / Role not allowed for this transition"
      );
    }
  }
}

export function buildVoucherStatusTransitionUpdate(
  toStatus: VoucherStatus,
  actor: VoucherTransitionActor,
  note?: string | null,
  now: Date = new Date()
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    status: toStatus,
  };

  switch (toStatus) {
    case "clerk_entered":
      data.clerkSubmittedAt = now;
      data.clerkSubmittedBy = actor.id;
      data.rejectedAt = null;
      data.rejectedBy = null;
      break;
    case "confirmed":
      data.clerkConfirmedAt = now;
      data.clerkConfirmedBy = actor.id;
      data.costAppliedAt = now;
      if (note != null && note.trim() !== "") {
        data.clerkNote = note.trim();
      }
      break;
    case "pending_review":
      data.clerkFlaggedAt = now;
      data.clerkFlaggedBy = actor.id;
      if (note != null && note.trim() !== "") {
        data.clerkNote = note.trim();
      }
      break;
    case "approved":
      data.reviewedAt = now;
      data.reviewedBy = actor.id;
      data.costAppliedAt = now;
      if (note != null && note.trim() !== "") {
        data.reviewNote = note.trim();
      }
      break;
    case "rejected":
      data.rejectedAt = now;
      data.rejectedBy = actor.id;
      data.costAppliedAt = null;
      data.reviewNote = note?.trim() ? note.trim() : null;
      break;
    default:
      break;
  }

  return data;
}

export async function applyVoucherStatusTransitionInTx(
  tx: Prisma.TransactionClient,
  input: {
    voucherId: string;
    fromStatus: VoucherStatus;
    toStatus: VoucherStatus;
    actor: VoucherTransitionActor;
    note?: string | null;
  }
) {
  const updateData = buildVoucherStatusTransitionUpdate(
    input.toStatus,
    input.actor,
    input.note
  );

  const voucher = await tx.driverVoucher.update({
    where: { id: input.voucherId },
    data: updateData,
  });

  await tx.driverVoucherChangeLog.create({
    data: {
      voucherId: input.voucherId,
      eventType: "status_change",
      field: "status",
      oldValue: input.fromStatus,
      newValue: input.toStatus,
      changedBy: input.actor.id,
      reason: input.note?.trim() ? input.note.trim() : null,
    },
  });

  return voucher;
}

export async function transitionVoucherStatus(input: {
  voucherId: string;
  toStatus: VoucherStatus;
  actor: VoucherTransitionActor;
  note?: string | null;
}) {
  const existing = await prisma.driverVoucher.findUnique({
    where: { id: input.voucherId },
    select: { id: true, status: true, tripSource: true },
  });

  if (!existing) {
    throw new VoucherStatusTransitionError(
      "NOT_FOUND",
      "报销单不存在 / Voucher not found"
    );
  }

  const fromStatus = existing.status as VoucherStatus;
  if (!isVoucherStatus(fromStatus)) {
    throw new VoucherStatusTransitionError(
      "INVALID_TRANSITION",
      `未知当前状态 / Unknown status: ${existing.status}`
    );
  }

  if (!isVoucherTransitionAllowed(fromStatus, input.toStatus)) {
    throw new VoucherStatusTransitionError(
      "INVALID_TRANSITION",
      `不允许从 ${fromStatus} 转到 ${input.toStatus} / Transition not allowed`
    );
  }

  assertActorCanTransition(input.actor, input.toStatus);

  if (input.toStatus === "rejected" && (!input.note || input.note.trim() === "")) {
    throw new VoucherStatusTransitionError(
      "INVALID_TRANSITION",
      "打回须填写原因 / Rejection reason required"
    );
  }

  if (
    input.toStatus === "pending_review" &&
    (!input.note || input.note.trim() === "")
  ) {
    throw new VoucherStatusTransitionError(
      "INVALID_TRANSITION",
      "标记需审核须填写备注 / Clerk note required when flagging for review"
    );
  }

  return prisma.$transaction(async (tx) => {
    await applyVoucherStatusTransitionInTx(tx, {
      voucherId: input.voucherId,
      fromStatus,
      toStatus: input.toStatus,
      actor: input.actor,
      note: input.note,
    });

    if (isVoucherCostEnforced() && existing.tripSource !== "charter") {
      if (input.toStatus === "confirmed" || input.toStatus === "approved") {
        return applyVoucherCostActuals(input.voucherId, tx);
      }
      if (input.toStatus === "rejected") {
        return clearVoucherCostActuals(input.voucherId, tx);
      }
    }

    return tx.driverVoucher.findUniqueOrThrow({
      where: { id: input.voucherId },
    });
  });
}
