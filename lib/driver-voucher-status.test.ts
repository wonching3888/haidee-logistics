import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assertActorCanTransition,
  buildVoucherStatusTransitionUpdate,
  isVoucherTransitionAllowed,
  transitionVoucherStatus,
  VoucherStatusTransitionError,
} from "@/lib/driver-voucher-status";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockChangeLogCreate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    driverVoucher: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    driverVoucherChangeLog: {
      create: (...args: unknown[]) => mockChangeLogCreate(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}));

describe("isVoucherTransitionAllowed", () => {
  it("allows draft → clerk_entered", () => {
    expect(isVoucherTransitionAllowed("draft", "clerk_entered")).toBe(true);
  });

  it("allows clerk_entered → confirmed and pending_review", () => {
    expect(isVoucherTransitionAllowed("clerk_entered", "confirmed")).toBe(true);
    expect(isVoucherTransitionAllowed("clerk_entered", "pending_review")).toBe(
      true
    );
  });

  it("allows pending_review → approved and rejected", () => {
    expect(isVoucherTransitionAllowed("pending_review", "approved")).toBe(true);
    expect(isVoucherTransitionAllowed("pending_review", "rejected")).toBe(true);
  });

  it("allows rejected → clerk_entered", () => {
    expect(isVoucherTransitionAllowed("rejected", "clerk_entered")).toBe(true);
  });

  it("rejects draft → approved", () => {
    expect(isVoucherTransitionAllowed("draft", "approved")).toBe(false);
  });

  it("rejects confirmed → rejected (reopen deferred)", () => {
    expect(isVoucherTransitionAllowed("confirmed", "rejected")).toBe(false);
  });
});

describe("assertActorCanTransition", () => {
  it("allows clerk to confirm", () => {
    expect(() =>
      assertActorCanTransition(
        { id: "u1", role: "clerk" },
        "confirmed"
      )
    ).not.toThrow();
  });

  it("allows thai_accounting to flag review", () => {
    expect(() =>
      assertActorCanTransition(
        { id: "u2", role: "thai_accounting" },
        "pending_review"
      )
    ).not.toThrow();
  });

  it("rejects clerk approve", () => {
    expect(() =>
      assertActorCanTransition({ id: "u1", role: "clerk" }, "approved")
    ).toThrow(VoucherStatusTransitionError);
  });

  it("allows admin approve and reject", () => {
    expect(() =>
      assertActorCanTransition({ id: "a1", role: "admin" }, "approved")
    ).not.toThrow();
    expect(() =>
      assertActorCanTransition({ id: "a1", role: "admin" }, "rejected")
    ).not.toThrow();
  });
});

describe("buildVoucherStatusTransitionUpdate", () => {
  const actor = { id: "user-1", role: "clerk" as const };
  const now = new Date("2026-06-25T12:00:00.000Z");

  it("sets clerk_submitted fields for clerk_entered", () => {
    const data = buildVoucherStatusTransitionUpdate(
      "clerk_entered",
      actor,
      null,
      now
    );
    expect(data).toMatchObject({
      status: "clerk_entered",
      clerkSubmittedAt: now,
      clerkSubmittedBy: "user-1",
      rejectedAt: null,
      rejectedBy: null,
    });
  });

  it("sets cost_applied_at for confirmed", () => {
    const data = buildVoucherStatusTransitionUpdate(
      "confirmed",
      actor,
      "ok",
      now
    );
    expect(data).toMatchObject({
      status: "confirmed",
      clerkConfirmedAt: now,
      clerkConfirmedBy: "user-1",
      costAppliedAt: now,
      clerkNote: "ok",
    });
  });

  it("sets reviewed fields and cost_applied_at for approved", () => {
    const data = buildVoucherStatusTransitionUpdate(
      "approved",
      { id: "admin-1", role: "admin" },
      "checked",
      now
    );
    expect(data).toMatchObject({
      status: "approved",
      reviewedAt: now,
      reviewedBy: "admin-1",
      costAppliedAt: now,
      reviewNote: "checked",
    });
  });

  it("clears cost_applied_at for rejected", () => {
    const data = buildVoucherStatusTransitionUpdate(
      "rejected",
      { id: "admin-1", role: "admin" },
      "amount mismatch",
      now
    );
    expect(data).toMatchObject({
      status: "rejected",
      rejectedAt: now,
      rejectedBy: "admin-1",
      costAppliedAt: null,
      reviewNote: "amount mismatch",
    });
  });
});

describe("transitionVoucherStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (fn) =>
      fn({
        driverVoucher: { update: mockUpdate },
        driverVoucherChangeLog: { create: mockChangeLogCreate },
      })
    );
  });

  it("performs draft → clerk_entered with change log", async () => {
    mockFindUnique.mockResolvedValue({ id: "v1", status: "draft" });
    mockUpdate.mockResolvedValue({ id: "v1", status: "clerk_entered" });

    const result = await transitionVoucherStatus({
      voucherId: "v1",
      toStatus: "clerk_entered",
      actor: { id: "clerk-1", role: "clerk" },
    });

    expect(result.status).toBe("clerk_entered");
    expect(mockChangeLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        voucherId: "v1",
        eventType: "status_change",
        field: "status",
        oldValue: "draft",
        newValue: "clerk_entered",
        changedBy: "clerk-1",
      }),
    });
  });

  it("rejects draft → approved", async () => {
    mockFindUnique.mockResolvedValue({ id: "v1", status: "draft" });

    await expect(
      transitionVoucherStatus({
        voucherId: "v1",
        toStatus: "approved",
        actor: { id: "admin-1", role: "admin" },
      })
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects clerk approving pending_review", async () => {
    mockFindUnique.mockResolvedValue({ id: "v1", status: "pending_review" });

    await expect(
      transitionVoucherStatus({
        voucherId: "v1",
        toStatus: "approved",
        actor: { id: "clerk-1", role: "clerk" },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows admin to approve pending_review", async () => {
    mockFindUnique.mockResolvedValue({ id: "v1", status: "pending_review" });
    mockUpdate.mockResolvedValue({ id: "v1", status: "approved" });

    await transitionVoucherStatus({
      voucherId: "v1",
      toStatus: "approved",
      actor: { id: "admin-1", role: "admin" },
      note: "ok",
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: expect.objectContaining({
        status: "approved",
        reviewedBy: "admin-1",
        costAppliedAt: expect.any(Date),
      }),
    });
  });

  it("requires note when flagging pending_review", async () => {
    mockFindUnique.mockResolvedValue({ id: "v1", status: "clerk_entered" });

    await expect(
      transitionVoucherStatus({
        voucherId: "v1",
        toStatus: "pending_review",
        actor: { id: "clerk-1", role: "clerk" },
      })
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("requires note when rejecting", async () => {
    mockFindUnique.mockResolvedValue({ id: "v1", status: "pending_review" });

    await expect(
      transitionVoucherStatus({
        voucherId: "v1",
        toStatus: "rejected",
        actor: { id: "admin-1", role: "admin" },
      })
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
});
