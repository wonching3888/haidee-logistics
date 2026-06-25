import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  effectiveMarketsForTripCost,
  mcAssignedLinesFromDispatchLines,
  pnlUnloadAllocatableQuantity,
  tripMcAllThirdParty,
  vehicleAllocatableQuantity,
} from "@/lib/mc-dispatch-delivery";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function allocateShare(part: number, total: number, amount: number) {
  if (total <= 0 || amount <= 0 || part <= 0) return 0;
  return roundMoney((part / total) * amount);
}

describe("effectiveMarketsForTripCost", () => {
  it("drops MC when all MC lines are third_party", () => {
    const markets = effectiveMarketsForTripCost(["KL", "SL", "MC"], [
      { marketCode: "MC", mcDeliveryMode: "third_party" },
      { marketCode: "MC", mcDeliveryMode: "third_party" },
    ]);
    assert.deepEqual(markets, ["KL", "SL"]);
  });

  it("keeps MC when any MC line is self delivery", () => {
    const markets = effectiveMarketsForTripCost(["KL", "MC"], [
      { marketCode: "MC", mcDeliveryMode: "third_party" },
      { marketCode: "MC", mcDeliveryMode: "self" },
    ]);
    assert.deepEqual(markets, ["KL", "MC"]);
  });

  it("leaves markets unchanged when no MC cargo", () => {
    const markets = effectiveMarketsForTripCost(["KL", "SL"], [
      { marketCode: "KL", mcDeliveryMode: null },
    ]);
    assert.deepEqual(markets, ["KL", "SL"]);
  });
});

describe("tripMcAllThirdParty", () => {
  it("is true only when every MC line is third_party", () => {
    assert.equal(
      tripMcAllThirdParty([
        { marketCode: "MC", mcDeliveryMode: "third_party" },
      ]),
      true
    );
    assert.equal(
      tripMcAllThirdParty([
        { marketCode: "MC", mcDeliveryMode: "third_party" },
        { marketCode: "MC", mcDeliveryMode: "self" },
      ]),
      false
    );
    assert.equal(tripMcAllThirdParty([{ marketCode: "KL", mcDeliveryMode: null }]), false);
  });
});

describe("pnl allocation by cost type", () => {
  const lines = [
    { market: "KL", qty: 244 },
    { market: "SL", qty: 36 },
    { market: "MC", qty: 42 },
  ];
  const excludeUnload = true;
  const totalBarrels = 322;
  const unloadBarrels = 280;
  const vehiclePool = 1873.05;
  const unloadPool = 334;

  it("unload allocatable parts sum to unload pool (denominator 280)", () => {
    const denom = lines.reduce(
      (sum, line) =>
        sum + pnlUnloadAllocatableQuantity(line.market, line.qty, excludeUnload),
      0
    );
    assert.equal(denom, unloadBarrels);

    let allocated = 0;
    for (const line of lines) {
      const part = pnlUnloadAllocatableQuantity(
        line.market,
        line.qty,
        excludeUnload
      );
      allocated += allocateShare(part, denom, unloadPool);
    }
    assert.equal(allocated, unloadPool);
  });

  it("vehicle costs use full trip barrels (denominator 322, MC included)", () => {
    let allocated = 0;
    for (const line of lines) {
      allocated += allocateShare(line.qty, totalBarrels, vehiclePool);
    }
    assert.equal(allocated, vehiclePool);
  });

  it("vehicleAllocatableQuantity excludes MC third_party lines", () => {
    assert.equal(vehicleAllocatableQuantity("MC", 42, "third_party"), 0);
    assert.equal(vehicleAllocatableQuantity("MC", 42, "self"), 42);
    assert.equal(vehicleAllocatableQuantity("KL", 10, null), 10);
  });

  it("MC third-party shipper: vehicle share = 0 with vehicleAllocatableQuantity", () => {
    const mcQty = 8;
    const vehicleQty = vehicleAllocatableQuantity("MC", mcQty, "third_party");
    const vehicleShare = allocateShare(vehicleQty, totalBarrels, vehiclePool);
    const unloadShare = allocateShare(
      pnlUnloadAllocatableQuantity("MC", mcQty, excludeUnload),
      unloadBarrels,
      unloadPool
    );
    assert.equal(vehicleQty, 0);
    assert.equal(vehicleShare, 0);
    assert.equal(unloadShare, 0);
  });

  it("MC third-party shipper (legacy denominator): vehicle share > 0 and unload share = 0", () => {
    const mcQty = 8;
    const vehicleShare = allocateShare(mcQty, totalBarrels, vehiclePool);
    const unloadShare = allocateShare(
      pnlUnloadAllocatableQuantity("MC", mcQty, excludeUnload),
      unloadBarrels,
      unloadPool
    );
    assert.ok(vehicleShare > 0);
    assert.equal(unloadShare, 0);
  });

  it("mixed shipper KL+MC: vehicle on all barrels, unload on KL only", () => {
    const klQty = 3;
    const mcQty = 4;
    const shipperQty = klQty + mcQty;
    const vehicleAlloc = allocateShare(shipperQty, totalBarrels, vehiclePool);
    const unloadAlloc =
      allocateShare(
        pnlUnloadAllocatableQuantity("KL", klQty, excludeUnload),
        unloadBarrels,
        unloadPool
      ) +
      allocateShare(
        pnlUnloadAllocatableQuantity("MC", mcQty, excludeUnload),
        unloadBarrels,
        unloadPool
      );
    assert.ok(vehicleAlloc > allocateShare(klQty, totalBarrels, vehiclePool));
    assert.equal(
      unloadAlloc,
      allocateShare(klQty, unloadBarrels, unloadPool)
    );
  });
});

describe("mcAssignedLinesFromDispatchLines", () => {
  it("collects assigned lines only", () => {
    const refs = mcAssignedLinesFromDispatchLines([
      {
        inboundLine: {
          dispatchStatus: "assigned",
          mcDeliveryMode: "third_party",
          stall: { market: { code: "MC" } },
        },
      },
      {
        inboundLine: {
          dispatchStatus: "unassigned",
          mcDeliveryMode: "third_party",
          stall: { market: { code: "MC" } },
        },
      },
    ]);
    assert.equal(refs.length, 1);
    assert.equal(refs[0]?.marketCode, "MC");
  });
});
