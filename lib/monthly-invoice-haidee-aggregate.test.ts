import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aggregateHaideeInvoiceLines } from "./monthly-invoice-haidee-aggregate";
import type { RawInvoiceLine } from "./monthly-invoice";

function baseLine(
  overrides: Partial<RawInvoiceLine> & Pick<RawInvoiceLine, "stallMarketCode">
): RawInvoiceLine {
  return {
    sessionDate: new Date("2026-06-10"),
    stallCode: "S1",
    stallName: null,
    tongTypeCode: "T1",
    quantity: 1,
    freightRate: 10,
    freightAmount: 10,
    isBox: false,
    shipperId: "s1",
    shipperCode: "3001-001",
    shipperName: "Shipper",
    consigneeId: null,
    consigneeCode: null,
    consigneeName: null,
    ...overrides,
  };
}

describe("aggregateHaideeInvoiceLines", () => {
  it("aggregates multiple markets with weighted average rate", () => {
    const rawLines: RawInvoiceLine[] = [
      baseLine({
        stallMarketCode: "KL",
        quantity: 10,
        freightRate: 40,
        freightAmount: 400,
      }),
      baseLine({
        stallMarketCode: "BP",
        quantity: 5,
        freightRate: 50,
        freightAmount: 250,
      }),
      baseLine({
        stallMarketCode: "KL",
        quantity: 2,
        freightRate: 45,
        freightAmount: 90,
      }),
    ];

    const result = aggregateHaideeInvoiceLines(rawLines);
    assert.equal(result.grandTotalAmount, 740);
    assert.equal(result.grandTotalQty, 17);

    const tong = result.sections.find((s) => s.kind === "tong");
    assert.ok(tong);
    assert.equal(tong.rows.length, 2);

    const kl = tong.rows.find((r) => r.marketCode === "KL");
    assert.ok(kl);
    assert.equal(kl.marketLabel, "SELAYANG");
    assert.equal(kl.quantity, 12);
    assert.equal(kl.amount, 490);
    assert.equal(kl.unitRate, 40.83);
  });

  it("splits tong and box sections", () => {
    const rawLines: RawInvoiceLine[] = [
      baseLine({
        stallMarketCode: "A",
        quantity: 3,
        freightAmount: 150,
        isBox: false,
      }),
      baseLine({
        stallMarketCode: "A",
        quantity: 4,
        freightAmount: 48,
        isBox: true,
        freightRate: 12,
      }),
    ];

    const result = aggregateHaideeInvoiceLines(rawLines);
    assert.equal(result.sections.length, 2);
    assert.equal(result.grandTotalAmount, 198);
    assert.equal(result.grandTotalQty, 7);

    const box = result.sections.find((s) => s.kind === "box");
    assert.ok(box);
    assert.equal(box.rows[0]?.marketLabel, "IPOH");
    assert.equal(box.rows[0]?.quantity, 4);
    assert.equal(box.rows[0]?.amount, 48);
  });

  it("ignores zero-freight lines", () => {
    const rawLines: RawInvoiceLine[] = [
      baseLine({ stallMarketCode: "MC", freightAmount: 0 }),
      baseLine({ stallMarketCode: "MC", freightAmount: null }),
    ];
    const result = aggregateHaideeInvoiceLines(rawLines);
    assert.equal(result.sections.length, 0);
    assert.equal(result.grandTotalAmount, 0);
  });
});
