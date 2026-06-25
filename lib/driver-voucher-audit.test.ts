import { describe, expect, it } from "vitest";
import {
  diffVoucherFieldChanges,
  formatVoucherAuditValue,
  voucherAuditFieldLabel,
} from "@/lib/driver-voucher-audit";
import type { DriverVoucher } from "@prisma/client";

function baseVoucher(overrides: Partial<DriverVoucher> = {}): DriverVoucher {
  return {
    id: "v1",
    voucherNo: "V-20260611-001",
    tripId: "trip-1",
    tripDate: new Date("2026-06-11"),
    lorry: "ABC1234",
    driverName: "Ali",
    route: "KL",
    chopBorderAmt: 10,
    chopBorderActual: 10,
    parkingAmt: 20,
    parkingActual: 20,
    kpbAmt: 30,
    kpbActual: 30,
    fishCheckAmt: 5,
    fishCheckActual: 5,
    upahTurunAmt: 15,
    upahTurunActual: 15,
    upahNaikTongAmt: 8,
    upahNaikTongActual: 8,
    minyakMotoEnabled: false,
    minyakMotoAmt: 8,
    minyakMotoActual: null,
    otherActual: null,
    duitJalan: 100,
    belanja: 88,
    baki: 12,
    status: "clerk_entered",
    clerkSubmittedAt: null,
    clerkSubmittedBy: null,
    clerkConfirmedAt: null,
    clerkConfirmedBy: null,
    clerkFlaggedAt: null,
    clerkFlaggedBy: null,
    reviewedAt: null,
    reviewedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    costAppliedAt: null,
    clerkNote: null,
    reviewNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("diffVoucherFieldChanges", () => {
  it("detects parking_actual change", () => {
    const existing = baseVoucher();
    const changes = diffVoucherFieldChanges(existing, {
      parkingActual: 23.35,
    });
    expect(changes).toEqual([
      {
        field: "parking_actual",
        oldValue: "20.00",
        newValue: "23.35",
      },
    ]);
  });

  it("ignores unchanged fields", () => {
    const existing = baseVoucher();
    const changes = diffVoucherFieldChanges(existing, {
      parkingActual: 20,
    });
    expect(changes).toEqual([]);
  });

  it("detects minyak_moto_enabled toggle", () => {
    const existing = baseVoucher();
    const changes = diffVoucherFieldChanges(existing, {
      minyakMotoEnabled: true,
    });
    expect(changes).toEqual([
      {
        field: "minyak_moto_enabled",
        oldValue: "false",
        newValue: "true",
      },
    ]);
  });
});

describe("formatVoucherAuditValue", () => {
  it("formats money to 2 decimals", () => {
    expect(formatVoucherAuditValue("duit_jalan", 100)).toBe("100.00");
  });
});

describe("voucherAuditFieldLabel", () => {
  it("returns Chinese label for audited fields", () => {
    expect(voucherAuditFieldLabel("parking_actual")).toContain("Parking");
  });

  it("returns status label", () => {
    expect(voucherAuditFieldLabel("status")).toBe("状态");
  });
});
