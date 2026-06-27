import { describe, expect, it } from "vitest";
import {
  buildCrateReturnImportContext,
  crateReturnCommissionAmount,
  crateReturnCommissionForTrip,
} from "@/lib/trip-allowance";

const rates = {
  bigTruckCrateCommission: 50,
  smallTruckCrateCommission: 30,
  bpCrateCommissionBigTruck: 210,
  bpCrateCommissionSmallTruck: 190,
};

function importContextFor(
  rows: {
    date: string;
    plate: string;
    market: string;
    quantity: number;
  }[]
) {
  return buildCrateReturnImportContext(
    rows.map((row) => ({
      date: row.date,
      quantity: row.quantity,
      truck: { plate: row.plate },
      market: { code: row.market },
    }))
  );
}

describe("crateReturnCommissionAmount", () => {
  it("uses normal 50/30 for non-BP returns", () => {
    const context = importContextFor([
      { date: "2026-06-15", plate: "T1", market: "KL", quantity: 2 },
    ]);
    const plateDay = context.get("2026-06-15|T1");
    expect(crateReturnCommissionAmount({ truckType: "big", plateDay, rates })).toBe(
      50
    );
    expect(
      crateReturnCommissionAmount({ truckType: "small", plateDay, rates })
    ).toBe(30);
  });

  it("uses BP 210/190 when any BP qty>0 on date+plate (口径A, no stacking)", () => {
    const context = importContextFor([
      { date: "2026-06-15", plate: "T1", market: "BP", quantity: 1 },
      { date: "2026-06-15", plate: "T1", market: "KL", quantity: 5 },
    ]);
    const plateDay = context.get("2026-06-15|T1");
    expect(crateReturnCommissionAmount({ truckType: "big", plateDay, rates })).toBe(
      210
    );
    expect(
      crateReturnCommissionAmount({ truckType: "small", plateDay, rates })
    ).toBe(190);
  });

  it("returns 0 when no positive qty return", () => {
    expect(
      crateReturnCommissionAmount({
        truckType: "big",
        plateDay: undefined,
        rates,
      })
    ).toBe(0);
  });
});

describe("crateReturnCommissionForTrip (one commission per physical return)", () => {
  it("pays only the designated recipient trip", () => {
    const context = importContextFor([
      { date: "2026-06-15", plate: "T1", market: "KL", quantity: 3 },
    ]);
    const plateDay = context.get("2026-06-15|T1");

    expect(
      crateReturnCommissionForTrip({
        truckType: "big",
        isCommissionRecipient: true,
        plateDay,
        rates,
      })
    ).toBe(50);

    expect(
      crateReturnCommissionForTrip({
        truckType: "big",
        isCommissionRecipient: false,
        plateDay,
        rates,
      })
    ).toBe(0);
  });

  it("BP rate applies to recipient charter trip same as dispatch", () => {
    const context = importContextFor([
      { date: "2026-06-15", plate: "T1", market: "BP", quantity: 2 },
    ]);
    const plateDay = context.get("2026-06-15|T1");

    expect(
      crateReturnCommissionForTrip({
        truckType: "big",
        isCommissionRecipient: true,
        plateDay,
        rates,
      })
    ).toBe(210);
  });
});

describe("one-return-one-commission scenario", () => {
  it("two trips same date+plate: only recipient gets commission (not 2x)", () => {
    const context = importContextFor([
      { date: "2026-06-15", plate: "T1", market: "KL", quantity: 4 },
    ]);
    const plateDay = context.get("2026-06-15|T1");

    const firstTrip = crateReturnCommissionForTrip({
      truckType: "big",
      isCommissionRecipient: true,
      plateDay,
      rates,
    });
    const secondTrip = crateReturnCommissionForTrip({
      truckType: "big",
      isCommissionRecipient: false,
      plateDay,
      rates,
    });

    expect(firstTrip).toBe(50);
    expect(secondTrip).toBe(0);
    expect(firstTrip + secondTrip).toBe(50);
  });
});
