import { describe, expect, it } from "vitest";
import { computeCrateStockAdjustments } from "./inbound-edit-sync";

const ABB = "type-abb";
const WTL = "type-wtl";
const BOX = "type-box";

const typeMap = new Map([
  [ABB, { trackInventory: true, isBox: false }],
  [WTL, { trackInventory: true, isBox: false }],
  [BOX, { trackInventory: true, isBox: true }],
]);

const bucketA = { shipperId: "shipper-a", location: "" };
const bucketB = { shipperId: "shipper-b", location: "SONGKHLA" };

describe("computeCrateStockAdjustments", () => {
  it("same bucket: ABB×4 → WTL×4 returns ABB +4 and borrows WTL −4 (agent stock)", () => {
    const adjustments = computeCrateStockAdjustments({
      beforeLines: [{ tongTypeId: ABB, quantity: 4 }],
      afterLines: [{ tongTypeId: WTL, quantity: 4 }],
      beforeBucket: bucketA,
      afterBucket: bucketA,
      typeMap,
    });

    expect(adjustments).toHaveLength(2);
    const abb = adjustments.find((a) => a.crateTypeId === ABB);
    const wtl = adjustments.find((a) => a.crateTypeId === WTL);
    expect(abb).toEqual({
      shipperId: bucketA.shipperId,
      location: bucketA.location,
      crateTypeId: ABB,
      delta: 4,
    });
    expect(wtl).toEqual({
      shipperId: bucketA.shipperId,
      location: bucketA.location,
      crateTypeId: WTL,
      delta: -4,
    });
  });

  it("same bucket: ABB×4 → ABB×6 borrows 2 more (−2 agent stock)", () => {
    const adjustments = computeCrateStockAdjustments({
      beforeLines: [{ tongTypeId: ABB, quantity: 4 }],
      afterLines: [{ tongTypeId: ABB, quantity: 6 }],
      beforeBucket: bucketA,
      afterBucket: bucketA,
      typeMap,
    });

    expect(adjustments).toEqual([
      {
        shipperId: bucketA.shipperId,
        location: bucketA.location,
        crateTypeId: ABB,
        delta: -2,
      },
    ]);
  });

  it("different bucket: returns before at old bucket and borrows after at new bucket", () => {
    const adjustments = computeCrateStockAdjustments({
      beforeLines: [{ tongTypeId: ABB, quantity: 4 }],
      afterLines: [{ tongTypeId: WTL, quantity: 4 }],
      beforeBucket: bucketA,
      afterBucket: bucketB,
      typeMap,
    });

    expect(adjustments).toHaveLength(2);
    expect(adjustments).toContainEqual({
      shipperId: bucketA.shipperId,
      location: bucketA.location,
      crateTypeId: ABB,
      delta: 4,
    });
    expect(adjustments).toContainEqual({
      shipperId: bucketB.shipperId,
      location: bucketB.location,
      crateTypeId: WTL,
      delta: -4,
    });
  });

  it("ignores box lines in crate adjustments", () => {
    const adjustments = computeCrateStockAdjustments({
      beforeLines: [{ tongTypeId: BOX, quantity: 10 }],
      afterLines: [{ tongTypeId: ABB, quantity: 3 }],
      beforeBucket: bucketA,
      afterBucket: bucketA,
      typeMap,
    });

    expect(adjustments).toEqual([
      {
        shipperId: bucketA.shipperId,
        location: bucketA.location,
        crateTypeId: ABB,
        delta: -3,
      },
    ]);
  });
});
