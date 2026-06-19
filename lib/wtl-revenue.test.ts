import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { InboundLineFreightSnapshot } from "@/lib/inbound-freight";
import { splitWtlSst } from "@/lib/wtl-sst";
import {
  dualPaymentWtlRevenueMyr,
  lineRevenueMyr,
  operationsFreightIncomeMyr,
  shouldExcludeWtlSstFromRevenue,
  wtlBillingFreightRevenueMyr,
  WTL_SST_EXCLUDE_FROM,
} from "@/lib/wtl-revenue";

const JUNE = new Date("2026-06-15T00:00:00.000Z");
const MAY = new Date("2026-05-31T00:00:00.000Z");

function baseSnapshot(
  overrides: Partial<InboundLineFreightSnapshot> = {}
): InboundLineFreightSnapshot {
  return {
    consigneeId: null,
    paymentParty: "consignee",
    paymentMode: "3",
    currency: "MYR",
    billingCompany: "wtl",
    freightRate: 45,
    freightAmount: 540,
    exchangeRate: 4.5,
    mcDeliveryMode: null,
    thirdPartyFee: null,
    mySegmentFreightRate: 45,
    mySegmentFreightAmount: 540,
    thFreightRate: null,
    thFreightAmount: null,
    dualPaymentWtlRate: null,
    dualPaymentWtlAmount: null,
    dualPaymentWtlConsigneeId: null,
    ...overrides,
  };
}

describe("shouldExcludeWtlSstFromRevenue", () => {
  it("is false before June 2026", () => {
    assert.equal(shouldExcludeWtlSstFromRevenue(MAY), false);
    assert.equal(
      shouldExcludeWtlSstFromRevenue(
        new Date(WTL_SST_EXCLUDE_FROM.getTime() - 1)
      ),
      false
    );
  });

  it("is true on and after 2026-06-01", () => {
    assert.equal(shouldExcludeWtlSstFromRevenue(WTL_SST_EXCLUDE_FROM), true);
    assert.equal(shouldExcludeWtlSstFromRevenue(JUNE), true);
  });
});

describe("P001 whole-MY via mySegment only (no TH)", () => {
  const p001 = baseSnapshot({
    paymentMode: "3",
    billingCompany: "wtl",
    freightAmount: 540,
    thFreightAmount: null,
    mySegmentFreightAmount: 540,
  });

  it("keeps inclusive amount before June 2026", () => {
    assert.equal(lineRevenueMyr(p001, 4.5, MAY), 540);
    assert.equal(operationsFreightIncomeMyr(p001, MAY), 540);
  });

  it("splits SST only once via mySegment (not freightAmount + mySegment)", () => {
    const expected = splitWtlSst(540).exTax;
    assert.equal(wtlBillingFreightRevenueMyr(p001, true), expected);
    assert.equal(lineRevenueMyr(p001, 4.5, JUNE), expected);
    assert.equal(operationsFreightIncomeMyr(p001, JUNE), expected);
    assert.notEqual(lineRevenueMyr(p001, 4.5, JUNE), splitWtlSst(540).exTax * 2);
    assert.ok(lineRevenueMyr(p001, 4.5, JUNE) < 540);
  });

  it("does not fall through to whole-freight split when mySegment is set", () => {
    const viaSegment = wtlBillingFreightRevenueMyr(p001, true);
    const wholeOnly = splitWtlSst(p001.freightAmount!).exTax;
    assert.equal(viaSegment, wholeOnly);
    assert.equal(viaSegment + splitWtlSst(p001.mySegmentFreightAmount!).exTax, wholeOnly * 2);
  });
});

describe("NKL dual-segment (TH + MY)", () => {
  const nkl = baseSnapshot({
    freightAmount: 290.08,
    thFreightAmount: 112,
    mySegmentFreightAmount: 178.08,
  });

  it("strips SST from MY segment only", () => {
    const myExTax = splitWtlSst(178.08).exTax;
    const expected = round2(112 + myExTax);
    assert.equal(lineRevenueMyr(nkl, 4.5, JUNE), expected);
    assert.equal(lineRevenueMyr(nkl, 4.5, JUNE), 280);
  });
});

describe("dual-payment POR MC", () => {
  const por = baseSnapshot({
    paymentMode: "1a",
    billingCompany: "haidee",
    currency: "THB",
    freightAmount: 150,
    thFreightAmount: null,
    mySegmentFreightAmount: null,
    dualPaymentWtlAmount: 135,
  });

  it("leaves THB main segment unchanged and strips SST from WTL dual portion", () => {
    const thbMyr = Math.round((150 / 4.5) * 100) / 100;
    const dualEx = splitWtlSst(135).exTax;
    assert.equal(lineRevenueMyr(por, 4.5, JUNE), round2(thbMyr + dualEx));
    assert.equal(dualPaymentWtlRevenueMyr(por, true), dualEx);
  });
});

describe("Mode 4 shipper WTL (1b + billing wtl)", () => {
  const mode4 = baseSnapshot({
    paymentParty: "shipper",
    paymentMode: "1b",
    freightAmount: 74.4,
    thFreightAmount: 32,
    mySegmentFreightAmount: 42.4,
  });

  it("applies ex-SST on MY segment from June 2026", () => {
    assert.equal(lineRevenueMyr(mode4, 4.5, MAY), 74.4);
    const expected = round2(32 + splitWtlSst(42.4).exTax);
    assert.equal(lineRevenueMyr(mode4, 4.5, JUNE), expected);
  });
});

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
