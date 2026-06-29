import { describe, expect, it } from "vitest";
import {
  buildCrateReturnImportContext,
  crateReturnCommissionAmount,
  crateReturnCommissionForTrip,
  crateReturnMultiMarketAllowanceAmount,
  crateReturnMultiMarketAllowanceForTrip,
  type CrateReturnCommissionRates,
} from "@/lib/trip-allowance";

const rates: CrateReturnCommissionRates = {
  bigTruckCrateCommission: 50,
  smallTruckCrateCommission: 30,
  bpCrateCommissionBigTruck: 210,
  bpCrateCommissionSmallTruck: 190,
};

function importContext(
  rows: {
    date?: string;
    plate: string;
    market: string;
    qty: number;
  }[]
) {
  return buildCrateReturnImportContext(
    rows.map((row) => ({
      date: row.date ?? "2026-06-29",
      quantity: row.qty,
      truck: { plate: row.plate },
      market: { code: row.market },
    }))
  );
}

describe("crateReturnMultiMarketAllowance", () => {
  it("adds flat RM30 when 2+ distinct primary markets with qty>0 (KL+A)", () => {
    const ctx = importContext([
      { plate: "KFU 3888", market: "KL", qty: 5 },
      { plate: "KFU 3888", market: "A", qty: 3 },
    ]);
    const plateDay = ctx.get("2026-06-29|KFU 3888");
    expect(crateReturnCommissionAmount({ truckType: "big", plateDay, rates })).toBe(
      50
    );
    expect(
      crateReturnMultiMarketAllowanceAmount({ plateDay, allowanceRate: 30 })
    ).toBe(30);
    expect(
      crateReturnCommissionForTrip({
        truckType: "big",
        isCommissionRecipient: true,
        plateDay,
        rates,
      }) +
        crateReturnMultiMarketAllowanceForTrip({
          isCommissionRecipient: true,
          plateDay,
          allowanceRate: 30,
        })
    ).toBe(80);
  });

  it("BM group P+TP counts as one market — no multi-market bonus", () => {
    const ctx = importContext([
      { plate: "PQK 6398", market: "P", qty: 4 },
      { plate: "PQK 6398", market: "TP", qty: 2 },
    ]);
    const plateDay = ctx.get("2026-06-29|PQK 6398");
    expect(plateDay?.returnMarketGroupCount).toBe(1);
    expect(
      crateReturnMultiMarketAllowanceAmount({ plateDay, allowanceRate: 30 })
    ).toBe(0);
  });

  it("single market returns no multi-market bonus", () => {
    const ctx = importContext([{ plate: "KGC 3888", market: "KL", qty: 2 }]);
    const plateDay = ctx.get("2026-06-29|KGC 3888");
    expect(
      crateReturnMultiMarketAllowanceAmount({ plateDay, allowanceRate: 30 })
    ).toBe(0);
  });

  it("qty=0 rows do not count toward market groups", () => {
    const ctx = buildCrateReturnImportContext([
      {
        date: "2026-06-29",
        quantity: 0,
        truck: { plate: "KGC 3888" },
        market: { code: "BP" },
      },
      {
        date: "2026-06-29",
        quantity: 5,
        truck: { plate: "KGC 3888" },
        market: { code: "KL" },
      },
    ]);
    const plateDay = ctx.get("2026-06-29|KGC 3888");
    expect(plateDay?.hasBpReturn).toBe(false);
    expect(plateDay?.returnMarketGroupCount).toBe(1);
    expect(
      crateReturnMultiMarketAllowanceAmount({ plateDay, allowanceRate: 30 })
    ).toBe(0);
  });

  it("non-recipient trip gets zero multi-market allowance", () => {
    const ctx = importContext([
      { plate: "KFU 3888", market: "KL", qty: 1 },
      { plate: "KFU 3888", market: "A", qty: 1 },
    ]);
    const plateDay = ctx.get("2026-06-29|KFU 3888");
    expect(
      crateReturnMultiMarketAllowanceForTrip({
        isCommissionRecipient: false,
        plateDay,
        allowanceRate: 30,
      })
    ).toBe(0);
  });
});
