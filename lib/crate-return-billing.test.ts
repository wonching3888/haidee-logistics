import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import {
  aggregateCrateReturnTrips,
  buildCrateReturnDetailRows,
  buildCrateReturnTripKey,
  sumDetailRowsByChargeKind,
  type CrateReturnImportRow,
} from "@/lib/crate-return-billing";

function importRow(input: {
  date: string;
  truckId: string;
  plate: string;
  marketId: string;
  marketCode: string;
  crateType: string;
  quantity: number;
}): CrateReturnImportRow {
  return {
    date: new Date(`${input.date}T00:00:00.000Z`),
    truckId: input.truckId,
    marketId: input.marketId,
    quantity: input.quantity,
    truck: { id: input.truckId, plate: input.plate },
    market: { id: input.marketId, code: input.marketCode },
    tongType: { code: input.crateType },
  } as CrateReturnImportRow;
}

describe("aggregateCrateReturnTrips", () => {
  it("merges imports with the same tripKey", () => {
    const trips = aggregateCrateReturnTrips(
      [
        importRow({
          date: "2026-06-05",
          truckId: "t1",
          plate: "W1234A",
          marketId: "m1",
          marketCode: "MC",
          crateType: "GLY",
          quantity: 10,
        }),
        importRow({
          date: "2026-06-05",
          truckId: "t1",
          plate: "W1234A",
          marketId: "m1",
          marketCode: "MC",
          crateType: "GLY",
          quantity: 5,
        }),
      ],
      "GLY"
    );
    expect(trips).toHaveLength(1);
    expect(trips[0]?.quantity).toBe(15);
    expect(trips[0]?.truckPlate).toBe("W1234A");
  });

  it("uses em dash when plate missing", () => {
    const row = importRow({
      date: "2026-06-05",
      truckId: "t1",
      plate: "",
      marketId: "m1",
      marketCode: "MC",
      crateType: "GLY",
      quantity: 3,
    });
    (row as { truck: { plate: string } }).truck.plate = "";
    const trips = aggregateCrateReturnTrips([row], "GLY");
    expect(trips[0]?.truckPlate).toBe("—");
  });
});

describe("buildCrateReturnDetailRows", () => {
  it("GLY emits one freight row per trip", () => {
    const trips = aggregateCrateReturnTrips(
      [
        importRow({
          date: "2026-06-05",
          truckId: "t1",
          plate: "W1",
          marketId: "mc",
          marketCode: "MC",
          crateType: "GLY",
          quantity: 330,
        }),
        importRow({
          date: "2026-06-06",
          truckId: "t2",
          plate: "W2",
          marketId: "oth",
          marketCode: "OTHERS",
          crateType: "GLY",
          quantity: 92,
        }),
      ],
      "GLY"
    );
    const rows = buildCrateReturnDetailRows({
      trips,
      freightRateMyr: 1.5,
      collectionRateMyr: 0,
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.chargeKind === "freight")).toBe(true);
    expect(rows.every((r) => r.chargeLabel === null)).toBe(true);
    const freightTotal = sumDetailRowsByChargeKind(rows, "freight");
    expect(freightTotal.amountMyr).toBe(633);
    expect(freightTotal.quantity).toBe(422);
    const mcAmount = rows
      .filter((r) => r.marketCode === "MC")
      .reduce((s, r) => s + r.amountMyr, 0);
    const othersAmount = rows
      .filter((r) => r.marketCode === "OTHERS")
      .reduce((s, r) => s + r.amountMyr, 0);
    expect(mcAmount).toBe(495);
    expect(othersAmount).toBe(138);
  });

  it("GKS emits freight + collection rows per trip (3.00 + 1.50, not 5.50)", () => {
    const trips = aggregateCrateReturnTrips(
      [
        importRow({
          date: "2026-06-05",
          truckId: "t1",
          plate: "W9",
          marketId: "mc",
          marketCode: "MC",
          crateType: "GKS",
          quantity: 10,
        }),
      ],
      "GKS"
    );
    const rows = buildCrateReturnDetailRows({
      trips,
      freightRateMyr: 3,
      collectionRateMyr: 1.5,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      chargeKind: "freight",
      unitRateMyr: 3,
      amountMyr: 30,
      chargeLabel: "车力 Freight",
    });
    expect(rows[1]).toMatchObject({
      chargeKind: "collection",
      unitRateMyr: 1.5,
      amountMyr: 15,
      chargeLabel: "收桶 Collection",
    });
    const freight = sumDetailRowsByChargeKind(rows, "freight");
    const collection = sumDetailRowsByChargeKind(rows, "collection");
    expect(freight.amountMyr).toBe(30);
    expect(collection.amountMyr).toBe(15);
    expect(freight.amountMyr + collection.amountMyr).toBe(45);
    expect(freight.amountMyr + collection.amountMyr).toBe(10 * (3 + 1.5));
  });
});

describe("buildCrateReturnTripKey", () => {
  it("matches partner trip key shape", () => {
    expect(
      buildCrateReturnTripKey({
        tripDateInput: "2026-06-05",
        truckId: "abc",
        marketId: "m1",
        crateType: "GLY",
      })
    ).toBe("2026-06-05|abc|m1|GLY");
  });
});
