import { describe, expect, it } from "vitest";
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
    expect(shouldExcludeWtlSstFromRevenue(MAY)).toBe(false);
    expect(
      shouldExcludeWtlSstFromRevenue(
        new Date(WTL_SST_EXCLUDE_FROM.getTime() - 1)
      )
    ).toBe(false);
  });

  it("is true on and after 2026-06-01", () => {
    expect(shouldExcludeWtlSstFromRevenue(WTL_SST_EXCLUDE_FROM)).toBe(true);
    expect(shouldExcludeWtlSstFromRevenue(JUNE)).toBe(true);
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
    expect(lineRevenueMyr(p001, 4.5, MAY)).toBe(540);
    expect(operationsFreightIncomeMyr(p001, MAY)).toBe(540);
  });

  it("splits SST only once via mySegment (not freightAmount + mySegment)", () => {
    const expected = splitWtlSst(540).exTax;
    expect(wtlBillingFreightRevenueMyr(p001, true)).toBe(expected);
    expect(lineRevenueMyr(p001, 4.5, JUNE)).toBe(expected);
    expect(operationsFreightIncomeMyr(p001, JUNE)).toBe(expected);
    expect(lineRevenueMyr(p001, 4.5, JUNE)).not.toBe(splitWtlSst(540).exTax * 2);
    expect(lineRevenueMyr(p001, 4.5, JUNE)).toBeLessThan(540);
  });

  it("does not fall through to whole-freight split when mySegment is set", () => {
    const viaSegment = wtlBillingFreightRevenueMyr(p001, true);
    const wholeOnly = splitWtlSst(p001.freightAmount!).exTax;
    expect(viaSegment).toBe(wholeOnly);
    expect(viaSegment + splitWtlSst(p001.mySegmentFreightAmount!).exTax).toBe(wholeOnly * 2);
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
    expect(lineRevenueMyr(nkl, 4.5, JUNE)).toBe(expected);
    expect(lineRevenueMyr(nkl, 4.5, JUNE)).toBe(280);
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
    expect(lineRevenueMyr(por, 4.5, JUNE)).toBe(round2(thbMyr + dualEx));
    expect(dualPaymentWtlRevenueMyr(por, true)).toBe(dualEx);
  });
});

describe("dual-payment line with NO primary rate (WTL secondary only)", () => {
  // Mirrors a POR-PATTANI-style relation where the shipper has no THB rate
  // on file this period (freightAmount stays null) but the dual-payment
  // secondary consignee rate IS configured, so dualPaymentWtlAmount is real
  // money. A missing primary leg must never drop a present secondary leg.
  const dualOnly = baseSnapshot({
    paymentMode: "1a",
    billingCompany: "haidee",
    currency: "THB",
    freightRate: null,
    freightAmount: null,
    thFreightAmount: null,
    mySegmentFreightAmount: null,
    dualPaymentWtlAmount: 424.5,
  });

  it("still recognizes the dual-payment secondary revenue after June 2026", () => {
    const expected = splitWtlSst(424.5).exTax;
    expect(lineRevenueMyr(dualOnly, 4.5, JUNE)).toBe(expected);
    expect(lineRevenueMyr(dualOnly, 4.5, JUNE)).toBeGreaterThan(0);
  });

  it("passes the dual amount through inclusive before June 2026 (no SST split)", () => {
    expect(lineRevenueMyr(dualOnly, 4.5, MAY)).toBe(424.5);
  });

  it("also recognizes it when freightAmount is exactly 0, not just null", () => {
    const zeroed = { ...dualOnly, freightAmount: 0, freightRate: 0 };
    expect(lineRevenueMyr(zeroed, 4.5, JUNE)).toBe(splitWtlSst(424.5).exTax);
  });

  it("still returns 0 when BOTH legs are empty", () => {
    const bothEmpty = { ...dualOnly, dualPaymentWtlAmount: null };
    expect(lineRevenueMyr(bothEmpty, 4.5, JUNE)).toBe(0);
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
    expect(lineRevenueMyr(mode4, 4.5, MAY)).toBe(74.4);
    const expected = round2(32 + splitWtlSst(42.4).exTax);
    expect(lineRevenueMyr(mode4, 4.5, JUNE)).toBe(expected);
  });
});

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
