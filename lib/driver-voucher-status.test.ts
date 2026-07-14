import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assertActorCanTransition,
  buildVoucherStatusTransitionUpdate,
  isVoucherTransitionAllowed,
  reopenVoucherStatus,
  transitionVoucherStatus,
  VoucherStatusTransitionError,
} from "@/lib/driver-voucher-status";

const mockFindUnique = vi.fn();
const mockFindUniqueOrThrow = vi.fn();
const mockUpdate = vi.fn();
const mockChangeLogCreate = vi.fn();
const mockTransaction = vi.fn();
const mockApplyVoucherCostActuals = vi.fn();
const mockClearVoucherCostActuals = vi.fn();
const mockApplyCharterVoucherCostActuals = vi.fn();
const mockClearCharterVoucherCostActuals = vi.fn();
const mockIsVoucherCostEnforced = vi.fn();
const mockInvalidatePnlTripsCache = vi.fn();
const mockSyncDriverVoucherSettlementCashBook = vi.fn();

vi.mock("@/lib/trip-cost-engine/config", () => ({
  isVoucherCostEnforced: () => mockIsVoucherCostEnforced(),
}));

vi.mock("@/lib/pnl-cache-invalidation", () => ({
  invalidatePnlTripsCache: () => mockInvalidatePnlTripsCache(),
}));

vi.mock("@/lib/cash-book/driver-voucher-cash-book", () => ({
  syncDriverVoucherSettlementCashBook: (...args: unknown[]) =>
    mockSyncDriverVoucherSettlementCashBook(...args),
  syncDriverVoucherAdvanceCashBook: vi.fn(),
}));

vi.mock("@/lib/driver-expense/voucher-cost-apply", () => ({
  applyVoucherCostActuals: (...args: unknown[]) =>
    mockApplyVoucherCostActuals(...args),
  clearVoucherCostActuals: (...args: unknown[]) =>
    mockClearVoucherCostActuals(...args),
}));

vi.mock("@/lib/driver-expense/charter-voucher-cost-apply", () => ({
  applyCharterVoucherCostActuals: (...args: unknown[]) =>
    mockApplyCharterVoucherCostActuals(...args),
  clearCharterVoucherCostActuals: (...args: unknown[]) =>
    mockClearCharterVoucherCostActuals(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    driverVoucher: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
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

  it("rejects confirmed → rejected (use admin reopen instead)", () => {
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
    mockIsVoucherCostEnforced.mockReturnValue(false);
    mockSyncDriverVoucherSettlementCashBook.mockResolvedValue("pv-1");
    mockFindUniqueOrThrow.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      status: "confirmed",
    }));
    mockTransaction.mockImplementation(async (fn) =>
      fn({
        driverVoucher: {
          update: mockUpdate,
          findUniqueOrThrow: mockFindUniqueOrThrow,
        },
        driverVoucherChangeLog: { create: mockChangeLogCreate },
      })
    );
  });

  it("performs draft → clerk_entered with change log", async () => {
    mockFindUnique.mockResolvedValue({ id: "v1", status: "draft" });
    mockUpdate.mockResolvedValue({ id: "v1", status: "clerk_entered" });
    mockFindUniqueOrThrow.mockResolvedValue({ id: "v1", status: "clerk_entered" });

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
    mockFindUniqueOrThrow.mockResolvedValue({ id: "v1", status: "approved" });

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
    expect(mockSyncDriverVoucherSettlementCashBook).not.toHaveBeenCalled();
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

  it("legacy mode does not call apply/clear on confirm", async () => {
    mockFindUnique.mockResolvedValue({ id: "v1", status: "clerk_entered" });
    mockUpdate.mockResolvedValue({ id: "v1", status: "confirmed" });
    mockFindUniqueOrThrow.mockResolvedValue({ id: "v1", status: "confirmed" });
    mockIsVoucherCostEnforced.mockReturnValue(false);

    await transitionVoucherStatus({
      voucherId: "v1",
      toStatus: "confirmed",
      actor: { id: "clerk-1", role: "clerk" },
      note: "ok",
    });

    expect(mockApplyVoucherCostActuals).not.toHaveBeenCalled();
    expect(mockClearVoucherCostActuals).not.toHaveBeenCalled();
    expect(mockSyncDriverVoucherSettlementCashBook).toHaveBeenCalledWith({
      driverVoucherId: "v1",
      actorUserId: "clerk-1",
      tx: expect.any(Object),
    });
    expect(mockFindUniqueOrThrow).toHaveBeenCalled();
  });

  it("enforced mode calls apply on confirm", async () => {
    mockFindUnique.mockResolvedValue({ id: "v1", status: "clerk_entered" });
    mockUpdate.mockResolvedValue({ id: "v1", status: "confirmed" });
    mockFindUniqueOrThrow.mockResolvedValue({ id: "v1", status: "confirmed" });
    mockIsVoucherCostEnforced.mockReturnValue(true);
    mockApplyVoucherCostActuals.mockResolvedValue({
      id: "v1",
      status: "confirmed",
    });

    const result = await transitionVoucherStatus({
      voucherId: "v1",
      toStatus: "confirmed",
      actor: { id: "clerk-1", role: "clerk" },
      note: "ok",
    });

    expect(mockApplyVoucherCostActuals).toHaveBeenCalledWith(
      "v1",
      expect.objectContaining({
        driverVoucher: expect.any(Object),
      })
    );
    expect(mockSyncDriverVoucherSettlementCashBook).toHaveBeenCalledWith({
      driverVoucherId: "v1",
      actorUserId: "clerk-1",
      tx: expect.any(Object),
    });
    expect(result.status).toBe("confirmed");
  });

  it("enforced mode calls clear on reject", async () => {
    mockFindUnique.mockResolvedValue({ id: "v1", status: "pending_review" });
    mockUpdate.mockResolvedValue({ id: "v1", status: "rejected" });
    mockIsVoucherCostEnforced.mockReturnValue(true);
    mockClearVoucherCostActuals.mockResolvedValue({
      id: "v1",
      status: "rejected",
      costAppliedAt: null,
    });

    const result = await transitionVoucherStatus({
      voucherId: "v1",
      toStatus: "rejected",
      actor: { id: "admin-1", role: "admin" },
      note: "fix amounts",
    });

    expect(mockClearVoucherCostActuals).toHaveBeenCalledWith(
      "v1",
      expect.any(Object)
    );
    expect(mockApplyVoucherCostActuals).not.toHaveBeenCalled();
    expect(mockSyncDriverVoucherSettlementCashBook).not.toHaveBeenCalled();
    expect(result.costAppliedAt).toBeNull();
  });
});

describe("reopenVoucherStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsVoucherCostEnforced.mockReturnValue(false);
    mockTransaction.mockImplementation(async (fn) =>
      fn({
        driverVoucher: {
          update: mockUpdate,
        },
        driverVoucherChangeLog: { create: mockChangeLogCreate },
      })
    );
  });

  it("rejects non-admin", async () => {
    mockFindUnique.mockResolvedValue({
      id: "v1",
      status: "confirmed",
      tripSource: "dispatch",
    });

    await expect(
      reopenVoucherStatus({
        voucherId: "v1",
        actor: { id: "clerk-1", role: "clerk" },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects reopen from draft", async () => {
    mockFindUnique.mockResolvedValue({
      id: "v1",
      status: "draft",
      tripSource: "dispatch",
    });

    await expect(
      reopenVoucherStatus({
        voucherId: "v1",
        actor: { id: "admin-1", role: "admin" },
      })
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("admin reopens confirmed dispatch voucher to clerk_entered", async () => {
    mockFindUnique.mockResolvedValue({
      id: "v1",
      status: "confirmed",
      tripSource: "dispatch",
    });
    mockUpdate.mockResolvedValue({
      id: "v1",
      status: "clerk_entered",
      costAppliedAt: null,
    });

    const result = await reopenVoucherStatus({
      voucherId: "v1",
      actor: { id: "admin-1", role: "admin" },
    });

    expect(result.status).toBe("clerk_entered");
    expect(mockChangeLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        voucherId: "v1",
        eventType: "reopen",
        field: "status",
        oldValue: "confirmed",
        newValue: "clerk_entered",
        changedBy: "admin-1",
      }),
    });
    expect(mockInvalidatePnlTripsCache).toHaveBeenCalled();
  });

  it("enforced mode clears charter overrides on reopen", async () => {
    mockIsVoucherCostEnforced.mockReturnValue(true);
    mockFindUnique.mockResolvedValue({
      id: "v2",
      status: "approved",
      tripSource: "charter",
    });
    mockUpdate.mockResolvedValue({
      id: "v2",
      status: "clerk_entered",
      costAppliedAt: null,
    });
    mockClearCharterVoucherCostActuals.mockResolvedValue(undefined);

    await reopenVoucherStatus({
      voucherId: "v2",
      actor: { id: "admin-1", role: "admin" },
    });

    expect(mockClearCharterVoucherCostActuals).toHaveBeenCalledWith(
      "v2",
      expect.any(Object)
    );
    expect(mockClearVoucherCostActuals).not.toHaveBeenCalled();
  });

  it("enforced mode clears dispatch overrides on reopen", async () => {
    mockIsVoucherCostEnforced.mockReturnValue(true);
    mockFindUnique.mockResolvedValue({
      id: "v3",
      status: "approved",
      tripSource: "dispatch",
    });
    mockUpdate.mockResolvedValue({
      id: "v3",
      status: "clerk_entered",
      costAppliedAt: null,
    });
    mockClearVoucherCostActuals.mockResolvedValue(undefined);

    await reopenVoucherStatus({
      voucherId: "v3",
      actor: { id: "admin-1", role: "admin" },
    });

    expect(mockClearVoucherCostActuals).toHaveBeenCalledWith(
      "v3",
      expect.any(Object)
    );
    expect(mockClearCharterVoucherCostActuals).not.toHaveBeenCalled();
  });
});
