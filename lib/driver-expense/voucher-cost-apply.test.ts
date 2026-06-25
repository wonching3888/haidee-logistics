import { describe, expect, it, vi } from "vitest";
import {
  applyVoucherCostActuals,
  clearVoucherCostActuals,
} from "@/lib/driver-expense/voucher-cost-apply";

type UnloadingRow = {
  id: string;
  market: string;
  unloadFeeOverride: number | null;
  kpbFeeOverride: number | null;
};

type LoadingRow = {
  id: string;
  loadingFeeOverride: number | null;
};

function createMockTx(state: {
  voucher: Record<string, unknown>;
  marketActuals: Array<{
    feeType: string;
    displayMarket: string;
    amount: number | null;
  }>;
  unloading: UnloadingRow[];
  loading: LoadingRow[];
}) {
  const unloadingUpdates: Array<{ id: string; data: Record<string, unknown> }> =
    [];
  const loadingUpdates: Array<{ tripId: string; data: Record<string, unknown> }> =
    [];

  const tx = {
    driverVoucher: {
      findUniqueOrThrow: vi.fn(async () => ({ ...state.voucher })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(state.voucher, data);
        return { ...state.voucher };
      }),
    },
    driverVoucherMarketActual: {
      findMany: vi.fn(async () =>
        state.marketActuals.map((row, index) => ({
          id: `ma-${index}`,
          voucherId: state.voucher.id,
          ...row,
        }))
      ),
    },
    unloadingFee: {
      findMany: vi.fn(async () => [...state.unloading]),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          unloadingUpdates.push({ id: where.id, data });
          const row = state.unloading.find((item) => item.id === where.id);
          if (row) Object.assign(row, data);
          return row;
        }
      ),
      updateMany: vi.fn(
        async ({
          data,
        }: {
          where: { tripId: string };
          data: Record<string, unknown>;
        }) => {
          for (const row of state.unloading) {
            Object.assign(row, data);
          }
          return { count: state.unloading.length };
        }
      ),
    },
    crateLoadingFee: {
      updateMany: vi.fn(
        async ({ data }: { data: Record<string, unknown> }) => {
          loadingUpdates.push({ tripId: state.voucher.tripId as string, data });
          for (const row of state.loading) {
            Object.assign(row, data);
          }
          return { count: state.loading.length };
        }
      ),
    },
  };

  return { tx, unloadingUpdates, loadingUpdates, state };
}

describe("applyVoucherCostActuals", () => {
  const now = new Date("2026-06-26T10:00:00.000Z");

  it("writes kpb unload overrides 1:1 for a direct market", async () => {
    const { tx, state } = createMockTx({
      voucher: {
        id: "v1",
        tripId: "trip-1",
        duitJalan: 200,
        chopBorderActual: null,
        parkingActual: null,
        kpbActual: null,
        fishCheckActual: null,
        upahTurunActual: null,
        upahNaikTongActual: null,
        minyakMotoEnabled: false,
        minyakMotoActual: null,
        otherActual: null,
      },
      marketActuals: [
        { feeType: "kpb", displayMarket: "BM", amount: 42 },
        { feeType: "unload", displayMarket: "BM", amount: 18 },
      ],
      unloading: [
        {
          id: "uf-bm",
          market: "BM",
          kpbFeeOverride: null,
          unloadFeeOverride: null,
        },
      ],
      loading: [],
    });

    const result = await applyVoucherCostActuals("v1", tx as never, now);

    expect(state.unloading[0]).toMatchObject({
      kpbFeeOverride: 42,
      unloadFeeOverride: 18,
    });
    expect(result).toMatchObject({
      kpbActual: 42,
      upahTurunActual: 18,
      costAppliedAt: now,
      belanja: 60,
      baki: 140,
    });
  });

  it("maps KL display amount to primary row and zeros sibling KL-group rows", async () => {
    const { tx, state } = createMockTx({
      voucher: {
        id: "v1",
        tripId: "trip-1",
        duitJalan: null,
        chopBorderActual: null,
        parkingActual: null,
        kpbActual: null,
        fishCheckActual: null,
        upahTurunActual: null,
        upahNaikTongActual: null,
        minyakMotoEnabled: false,
        minyakMotoActual: null,
        otherActual: null,
      },
      marketActuals: [{ feeType: "unload", displayMarket: "KL", amount: 55 }],
      unloading: [
        {
          id: "uf-kl",
          market: "KL",
          kpbFeeOverride: null,
          unloadFeeOverride: null,
        },
        {
          id: "uf-bp",
          market: "BP",
          kpbFeeOverride: null,
          unloadFeeOverride: null,
        },
      ],
      loading: [],
    });

    await applyVoucherCostActuals("v1", tx as never, now);

    expect(state.unloading[0]).toMatchObject({ unloadFeeOverride: 55 });
    expect(state.unloading[1]).toMatchObject({ unloadFeeOverride: 0 });
  });

  it("maps BM Pindah unload to the first per-trip market row on the trip", async () => {
    const { tx, state } = createMockTx({
      voucher: {
        id: "v1",
        tripId: "trip-1",
        duitJalan: null,
        chopBorderActual: null,
        parkingActual: null,
        kpbActual: null,
        fishCheckActual: null,
        upahTurunActual: null,
        upahNaikTongActual: null,
        minyakMotoEnabled: false,
        minyakMotoActual: null,
        otherActual: null,
      },
      marketActuals: [
        { feeType: "unload", displayMarket: "BM Pindah", amount: 20 },
      ],
      unloading: [
        {
          id: "uf-tp",
          market: "TP",
          kpbFeeOverride: null,
          unloadFeeOverride: null,
        },
        {
          id: "uf-p",
          market: "P",
          kpbFeeOverride: null,
          unloadFeeOverride: null,
        },
      ],
      loading: [],
    });

    await applyVoucherCostActuals("v1", tx as never, now);

    const tp = state.unloading.find((row) => row.market === "TP");
    const p = state.unloading.find((row) => row.market === "P");
    expect(p).toMatchObject({ unloadFeeOverride: 20 });
    expect(tp).toMatchObject({ unloadFeeOverride: 0 });
  });

  it("mirrors parking to voucher.parking_actual without unloading overrides", async () => {
    const { tx, state } = createMockTx({
      voucher: {
        id: "v1",
        tripId: "trip-1",
        duitJalan: null,
        chopBorderActual: null,
        parkingActual: null,
        kpbActual: null,
        fishCheckActual: null,
        upahTurunActual: null,
        upahNaikTongActual: null,
        minyakMotoEnabled: false,
        minyakMotoActual: null,
        otherActual: null,
      },
      marketActuals: [
        { feeType: "parking", displayMarket: "BM", amount: 7 },
        { feeType: "parking", displayMarket: "MC", amount: 3 },
      ],
      unloading: [],
      loading: [],
    });

    const result = await applyVoucherCostActuals("v1", tx as never, now);

    expect(result.parkingActual).toBe(10);
    expect(state.unloading).toHaveLength(0);
  });
});

describe("clearVoucherCostActuals", () => {
  it("clears unloading and loading overrides and cost_applied_at", async () => {
    const { tx, state } = createMockTx({
      voucher: {
        id: "v1",
        tripId: "trip-1",
        costAppliedAt: new Date("2026-06-25T00:00:00Z"),
      },
      marketActuals: [
        { feeType: "kpb", displayMarket: "BM", amount: 10 },
      ],
      unloading: [
        {
          id: "uf-bm",
          market: "BM",
          kpbFeeOverride: 10,
          unloadFeeOverride: 5,
        },
      ],
      loading: [{ id: "lf-1", loadingFeeOverride: 30 }],
    });

    const result = await clearVoucherCostActuals("v1", tx as never);

    expect(state.unloading[0]).toMatchObject({
      kpbFeeOverride: null,
      unloadFeeOverride: null,
    });
    expect(state.loading[0]).toMatchObject({ loadingFeeOverride: null });
    expect(result.costAppliedAt).toBeNull();
    expect(state.marketActuals).toHaveLength(1);
  });
});
