import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { splitWtlSst } from "./wtl-sst";
import { aggregateInvoiceLines, buildInvoiceListing } from "./monthly-invoice-aggregate";

describe("splitWtlSst", () => {
  it("splits inclusive MY total with exTax + sst = inclusive", () => {
    const result = splitWtlSst(106);
    assert.equal(result.inclusive, 106);
    assert.equal(result.exTax, 100);
    assert.equal(result.sst, 6);
    assert.equal(result.exTax + result.sst, result.inclusive);
  });

  it("returns zeros for non-positive input", () => {
    assert.deepEqual(splitWtlSst(0), { inclusive: 0, exTax: 0, sst: 0 });
  });
});

describe("aggregateInvoiceLines", () => {
  it("preserves grand total for dual-segment lines", () => {
    const rawLines = [
      {
        sessionDate: new Date("2026-06-16"),
        stallMarketCode: "KL",
        stallCode: "S1",
        stallName: null,
        tongTypeCode: "T1",
        quantity: 10,
        freightRate: 53,
        freightAmount: 530,
        thFreightRate: 20,
        thFreightAmount: 200,
        mySegmentFreightRate: 33,
        mySegmentFreightAmount: 330,
        isBox: false,
        shipperId: "s1",
        shipperCode: "3000-B002",
        shipperName: "BEST BROTHER",
        consigneeId: null,
        consigneeCode: null,
        consigneeName: null,
      },
      {
        sessionDate: new Date("2026-06-17"),
        stallMarketCode: "BP",
        stallCode: "B1",
        stallName: null,
        tongTypeCode: "BX",
        quantity: 2,
        freightRate: 100,
        freightAmount: 200,
        thFreightRate: 40,
        thFreightAmount: 80,
        mySegmentFreightRate: 60,
        mySegmentFreightAmount: 120,
        isBox: true,
        shipperId: "s1",
        shipperCode: "3000-B002",
        shipperName: "BEST BROTHER",
        consigneeId: null,
        consigneeCode: null,
        consigneeName: null,
      },
    ];

    const legacyTotal = rawLines.reduce(
      (sum, line) => sum + (line.freightAmount ?? 0),
      0
    );
    const aggregated = aggregateInvoiceLines(rawLines);

    assert.equal(aggregated.grandTotalAmount, legacyTotal);
    assert.equal(
      aggregated.totals.totalInclusive,
      aggregated.grandTotalAmount
    );
    assert.equal(
      aggregated.totals.subTotalExcludingTax + aggregated.totals.sstAmount,
      aggregated.grandTotalAmount
    );

    const listing = buildInvoiceListing(rawLines);
    const tongInvoiceQty = aggregated.sections.find((s) => s.kind === "tong")
      ?.totalQty;
    const tongListingQty = listing.sections.find((s) => s.kind === "tong")
      ?.grandTotal;
    assert.equal(tongInvoiceQty, tongListingQty);
  });

  it("mode3 mapping treats freightAmount as MY when segments are null", () => {
    const rawLines = [
      {
        sessionDate: new Date("2026-06-15"),
        stallMarketCode: "MC",
        stallCode: "MC65",
        stallName: null,
        tongTypeCode: "T1",
        quantity: 12,
        freightRate: 45,
        freightAmount: 540,
        thFreightRate: null,
        thFreightAmount: null,
        mySegmentFreightRate: null,
        mySegmentFreightAmount: null,
        isBox: false,
        shipperId: "s1",
        shipperCode: "3001-P004",
        shipperName: "POR",
        consigneeId: "c1",
        consigneeCode: "3000-P001",
        consigneeName: "P001",
      },
    ];

    const aggregated = aggregateInvoiceLines(rawLines, {
      segmentMapping: "mode3",
    });

    assert.equal(aggregated.grandTotalAmount, 540);
    assert.equal(aggregated.grandThTotalAmount, 0);
    assert.equal(aggregated.grandMyInclusiveTotal, 540);
    assert.equal(aggregated.sections[0]?.thRow, null);
    assert.equal(aggregated.sections[0]?.myRows[0]?.amount, 540);
  });

  it("mode3 mapping preserves TH+MY dual-segment lines", () => {
    const rawLines = [
      {
        sessionDate: new Date("2026-06-01"),
        stallMarketCode: "KT",
        stallCode: "NKL",
        stallName: null,
        tongTypeCode: "BX",
        quantity: 14,
        freightRate: 20.72,
        freightAmount: 290.08,
        thFreightRate: 8,
        thFreightAmount: 112,
        mySegmentFreightRate: 12.72,
        mySegmentFreightAmount: 178.08,
        isBox: true,
        shipperId: "s1",
        shipperCode: "3001-008",
        shipperName: "SOPHON",
        consigneeId: "c2",
        consigneeCode: "3000-N001",
        consigneeName: "NKL",
      },
    ];

    const aggregated = aggregateInvoiceLines(rawLines, {
      segmentMapping: "mode3",
    });

    assert.equal(aggregated.grandTotalAmount, 290.08);
    assert.equal(aggregated.sections[0]?.thRow?.amount, 112);
    assert.equal(aggregated.sections[0]?.myRows[0]?.amount, 178.08);
  });
});
