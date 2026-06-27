import { describe, expect, it, vi } from "vitest";
import {
  applyCharterVoucherCostActuals,
  clearCharterVoucherCostActuals,
} from "@/lib/driver-expense/charter-voucher-cost-apply";

function createMockTx(state: {
  voucher: Record<string, unknown>;
  charterTrip: Record<string, unknown>;
}) {
  const tx = {
    driverVoucher: {
      findUniqueOrThrow: vi.fn(async () => ({ ...state.voucher })),
    },
    charterTrip: {
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          if (where.id !== state.charterTrip.id) {
            throw new Error("charter trip not found");
          }
          Object.assign(state.charterTrip, data);
          return { ...state.charterTrip };
        }
      ),
    },
  };
  return tx;
}

describe("applyCharterVoucherCostActuals", () => {
  it("writes unload and other actuals to override columns", async () => {
    const state = {
      voucher: {
        id: "v1",
        tripId: "trip-1",
        tripSource: "charter",
        upahTurunActual: 280,
        otherActual: 20,
      },
      charterTrip: {
        id: "trip-1",
        charterUnloadFeeOverride: null,
        charterOtherCostOverride: null,
      },
    };
    const tx = createMockTx(state);

    await applyCharterVoucherCostActuals("v1", tx as never);

    expect(tx.charterTrip.update).toHaveBeenCalledWith({
      where: { id: "trip-1" },
      data: {
        charterUnloadFeeOverride: 280,
        charterOtherCostOverride: 20,
      },
    });
    expect(state.charterTrip.charterUnloadFeeOverride).toBe(280);
    expect(state.charterTrip.charterOtherCostOverride).toBe(20);
  });

  it("rejects dispatch vouchers", async () => {
    const tx = createMockTx({
      voucher: {
        id: "v1",
        tripId: "trip-1",
        tripSource: "dispatch",
        upahTurunActual: 280,
        otherActual: 20,
      },
      charterTrip: { id: "trip-1", charterUnloadFeeOverride: null },
    });

    await expect(
      applyCharterVoucherCostActuals("v1", tx as never)
    ).rejects.toThrow(/charter voucher/);
  });
});

describe("clearCharterVoucherCostActuals", () => {
  it("clears unload and other override columns", async () => {
    const state = {
      voucher: {
        id: "v1",
        tripId: "trip-1",
        tripSource: "charter",
      },
      charterTrip: {
        id: "trip-1",
        charterUnloadFeeOverride: 280,
        charterOtherCostOverride: 20,
      },
    };
    const tx = createMockTx(state);

    await clearCharterVoucherCostActuals("v1", tx as never);

    expect(tx.charterTrip.update).toHaveBeenCalledWith({
      where: { id: "trip-1" },
      data: {
        charterUnloadFeeOverride: null,
        charterOtherCostOverride: null,
      },
    });
    expect(state.charterTrip.charterUnloadFeeOverride).toBeNull();
    expect(state.charterTrip.charterOtherCostOverride).toBeNull();
  });
});
