import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockDelete = vi.fn();
const mockDeleteMany = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    driverPayrollTrip: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    dispatchOrder: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    charterTrip: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("@/app/actions/allowance-settings", () => ({
  loadPayrollAllowanceContext: vi.fn(),
}));

import {
  cleanupCancelledDispatchPayrollOrphans,
  finalizeDispatchCancelPayroll,
  findCancelledDispatchPayrollOrphans,
  handleDriverPayrollTripOnDispatchCancel,
  payrollTripHasManualOverrides,
} from "@/lib/driver-payroll-trip-sync";

describe("payrollTripHasManualOverrides", () => {
  it("treats extraAllowance > 0 as manual override", () => {
    expect(payrollTripHasManualOverrides({ extraAllowance: 0 })).toBe(false);
    expect(payrollTripHasManualOverrides({ extraAllowance: 10 })).toBe(true);
  });
});

describe("handleDriverPayrollTripOnDispatchCancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes payroll row when there is no manual override", async () => {
    mockFindUnique.mockResolvedValue({
      id: "trip-1",
      extraAllowance: 0,
      crateReturnCommission: 50,
    });
    mockDelete.mockResolvedValue({});

    const result = await handleDriverPayrollTripOnDispatchCancel("dispatch-1");

    expect(result.deleted).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "trip-1" } });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("keeps row and zeroes tripAllowance when extraAllowance is manual", async () => {
    mockFindUnique.mockResolvedValue({
      id: "trip-2",
      extraAllowance: 25,
      crateReturnCommission: 50,
    });
    mockUpdate.mockResolvedValue({});

    const result = await handleDriverPayrollTripOnDispatchCancel("dispatch-2");

    expect(result.deleted).toBe(false);
    expect(result.keptForManualOverrides).toBe(true);
    expect(result.zeroedTripAllowance).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "trip-2" },
      data: { tripAllowance: 0 },
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe("finalizeDispatchCancelPayroll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes payroll row then re-syncs crate-return winners for date+plate", async () => {
    mockFindUnique.mockResolvedValue({
      id: "trip-1",
      extraAllowance: 0,
      crateReturnCommission: 50,
    });
    mockDelete.mockResolvedValue({});

    const date = new Date("2026-06-19T00:00:00.000Z");
    const result = await finalizeDispatchCancelPayroll({
      dispatchOrderId: "dispatch-1",
      date,
      plate: "VNN 3888",
    });

    expect(result.deleted).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "trip-1" } });
  });
});

describe("cancelled dispatch orphan cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findCancelledDispatchPayrollOrphans splits auto-delete vs protected vs review", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "orphan-1",
        dispatchOrderId: "d1",
        date: new Date("2026-06-19T00:00:00.000Z"),
        notes: "VNN 3888",
        tripAllowance: 0,
        extraAllowance: 0,
        crateReturnCommission: 50,
        dispatchOrder: { dispatchNo: "DO-1", driverName: "Naim" },
        payrollMonth: { driver: { name: "Naim" } },
      },
      {
        id: "orphan-2",
        dispatchOrderId: "d2",
        date: new Date("2026-06-20T00:00:00.000Z"),
        notes: "ABC 1234",
        tripAllowance: 100,
        extraAllowance: 20,
        crateReturnCommission: 0,
        dispatchOrder: { dispatchNo: "DO-2", driverName: "Ali" },
        payrollMonth: { driver: { name: "Ali" } },
      },
      {
        id: "orphan-3",
        dispatchOrderId: "d3",
        date: new Date("2026-06-21T00:00:00.000Z"),
        notes: "KFR 3888",
        tripAllowance: 300,
        extraAllowance: 0,
        crateReturnCommission: 0,
        dispatchOrder: { dispatchNo: "DO-3", driverName: "Awang" },
        payrollMonth: { driver: { name: "Awang" } },
      },
    ]);

    const scan = await findCancelledDispatchPayrollOrphans();

    expect(scan.deletable).toHaveLength(1);
    expect(scan.deletable[0]?.dispatchNo).toBe("DO-1");
    expect(scan.protectedManual).toHaveLength(1);
    expect(scan.protectedManual[0]?.dispatchNo).toBe("DO-2");
    expect(scan.needsManualReview).toHaveLength(1);
    expect(scan.needsManualReview[0]?.dispatchNo).toBe("DO-3");
  });

  it("isCancelledDispatchOrphanAutoDeletable requires zero trip and extra allowance", async () => {
    const { isCancelledDispatchOrphanAutoDeletable } = await import(
      "@/lib/driver-payroll-trip-sync"
    );
    expect(
      isCancelledDispatchOrphanAutoDeletable({
        tripAllowance: 0,
        extraAllowance: 0,
      })
    ).toBe(true);
    expect(
      isCancelledDispatchOrphanAutoDeletable({
        tripAllowance: 300,
        extraAllowance: 0,
      })
    ).toBe(false);
  });

  it("cleanupCancelledDispatchPayrollOrphans deletes only deletable rows", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "orphan-1",
        dispatchOrderId: "d1",
        date: new Date("2026-06-19T00:00:00.000Z"),
        notes: "VNN 3888",
        tripAllowance: 0,
        extraAllowance: 0,
        crateReturnCommission: 50,
        dispatchOrder: { dispatchNo: "DO-1", driverName: "Naim" },
        payrollMonth: { driver: { name: "Naim" } },
      },
    ]);
    mockDeleteMany.mockResolvedValue({ count: 1 });

    const result = await cleanupCancelledDispatchPayrollOrphans();

    expect(result.deletable).toHaveLength(1);
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["orphan-1"] } },
    });
  });
});
