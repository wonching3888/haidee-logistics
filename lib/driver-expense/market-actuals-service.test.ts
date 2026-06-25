import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listMarketActualsByVoucherId,
  sumMarketActualAmounts,
  upsertMarketActualsForVoucher,
} from "@/lib/driver-expense/market-actuals-service";

const mockFindMany = vi.fn();
const mockUpsert = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    driverVoucherMarketActual: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
    $transaction: (ops: unknown[]) => mockTransaction(ops),
  },
}));

describe("market-actuals-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (ops: Promise<unknown>[]) => {
      for (const op of ops) await op;
      return [];
    });
    mockUpsert.mockImplementation(async (args: { create: Record<string, unknown> }) => ({
      id: "row-1",
      ...args.create,
      createdAt: new Date("2026-06-16T00:00:00Z"),
      updatedAt: new Date("2026-06-16T00:00:00Z"),
    }));
    mockFindMany.mockResolvedValue([
      {
        id: "row-1",
        voucherId: "v1",
        feeType: "parking",
        displayMarket: "BM",
        amount: 12.5,
        createdAt: new Date("2026-06-16T00:00:00Z"),
        updatedAt: new Date("2026-06-16T00:00:00Z"),
      },
    ]);
  });

  it("lists rows by voucher id", async () => {
    const rows = await listMarketActualsByVoucherId("v1");
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { voucherId: "v1" },
      orderBy: [{ feeType: "asc" }, { displayMarket: "asc" }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.feeType).toBe("parking");
    expect(rows[0]?.displayMarket).toBe("BM");
  });

  it("upserts market actual rows in a transaction", async () => {
    const rows = await upsertMarketActualsForVoucher("v1", [
      { feeType: "parking", displayMarket: "BM", amount: 12.5 },
      { feeType: "kpb", displayMarket: "MC", amount: 8 },
    ]);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(rows).toHaveLength(1);
  });

  it("sums amounts by fee type", () => {
    const total = sumMarketActualAmounts(
      [
        { feeType: "parking", amount: 10 },
        { feeType: "parking", amount: 5.5 },
        { feeType: "kpb", amount: 20 },
        { feeType: "unload", amount: null },
      ],
      "parking"
    );
    expect(total).toBe(15.5);
  });
});
