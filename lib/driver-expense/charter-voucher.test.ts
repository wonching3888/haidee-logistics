import { describe, expect, it } from "vitest";
import {
  sumActualBelanja,
  sumCharterActualBelanja,
  sumCharterSuggestedAmounts,
  hasVoucherSettlementActuals,
  isAdvancePendingSettlement,
} from "@/lib/driver-expense/voucher-utils";
import {
  buildUnenteredTodoHref,
  TODO_VOUCHER_STATUSES,
} from "@/lib/driver-expense/todo-list";
import { expenseTripKey } from "@/lib/driver-expense/trip-source";

describe("charter voucher belanja", () => {
  it("sums only 6 charter reimbursement lines excluding duit jalan", () => {
    const belanja = sumCharterActualBelanja({
      chopBorderActual: 25,
      upahTurunActual: 350,
      upahNaikTongActual: 120,
      minyakMotoEnabled: true,
      minyakMotoActual: 8,
      otherActual: 15,
    });
    expect(belanja).toBe(518);
  });

  it("routes sumActualBelanja through charter branch", () => {
    const belanja = sumActualBelanja(
      {
        chopBorderActual: 10,
        parkingActual: 99,
        kpbActual: 99,
        fishCheckActual: 99,
        upahTurunActual: 20,
        upahNaikTongActual: 30,
        minyakMotoEnabled: false,
        minyakMotoActual: null,
        otherActual: 5,
      },
      { tripSource: "charter" }
    );
    expect(belanja).toBe(65);
  });

  it("computes charter suggested subtotal without parking/kpb/fish", () => {
    expect(
      sumCharterSuggestedAmounts({
        chopBorderAmt: 25,
        upahTurunAmt: 350,
        upahNaikTongAmt: 0,
        minyakMotoEnabled: true,
        minyakMotoAmt: 8,
      })
    ).toBe(383);
  });
});

describe("charter todo links", () => {
  it("includes tripSource=charter for charter unentered items", () => {
    expect(
      buildUnenteredTodoHref({
        kind: "unentered",
        tripId: "abc",
        tripSource: "charter",
        tripDate: "2026-06-19",
        lorry: "ABC1234",
        driverName: "Ali",
        route: "CH-001 包车",
        dispatchNo: null,
        charterNo: "CH-001",
        status: "unentered",
        unsettledDays: 0,
      })
    ).toBe("/documents/driver-expenses/new?date=2026-06-19&tripId=abc&tripSource=charter");
  });
});

describe("expenseTripKey", () => {
  it("namespaces dispatch and charter trip ids", () => {
    expect(expenseTripKey("same-uuid", "dispatch")).toBe("dispatch:same-uuid");
    expect(expenseTripKey("same-uuid", "charter")).toBe("charter:same-uuid");
  });
});

const emptyActuals = {
  chopBorderActual: null,
  parkingActual: null,
  kpbActual: null,
  fishCheckActual: null,
  upahTurunActual: null,
  upahNaikTongActual: null,
  minyakMotoEnabled: false,
  minyakMotoActual: null,
  otherActual: null,
};

describe("advance pending settlement helpers", () => {
  it("includes draft in TODO_VOUCHER_STATUSES", () => {
    expect(TODO_VOUCHER_STATUSES).toContain("draft");
  });

  it("detects settlement Actual presence", () => {
    expect(hasVoucherSettlementActuals(emptyActuals)).toBe(false);
    expect(
      hasVoucherSettlementActuals({ ...emptyActuals, otherActual: 1 })
    ).toBe(true);
  });

  it("labels advance-pending only for draft + duitJalan + empty Actuals", () => {
    expect(
      isAdvancePendingSettlement({
        status: "draft",
        duitJalan: 200,
        ...emptyActuals,
      })
    ).toBe(true);
    expect(
      isAdvancePendingSettlement({
        status: "draft",
        duitJalan: null,
        ...emptyActuals,
      })
    ).toBe(false);
  });
});
