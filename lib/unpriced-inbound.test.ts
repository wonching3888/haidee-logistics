import { describe, expect, it } from "vitest";
import { isWrongZeroFreightSnapshot } from "@/lib/inbound-freight";
import {
  billingGapReasonLabel,
  ZERO_AMOUNT_WITH_RATE_LABEL,
} from "@/lib/unpriced-inbound";

describe("isWrongZeroFreightSnapshot", () => {
  it("flags stored zero when recompute is positive", () => {
    expect(isWrongZeroFreightSnapshot(0, 1460)).toBe(true);
  });

  it("ignores legitimate zero when recompute is also zero", () => {
    expect(isWrongZeroFreightSnapshot(0, 0)).toBe(false);
    expect(isWrongZeroFreightSnapshot(0, null)).toBe(false);
  });

  it("ignores null or positive stored amounts", () => {
    expect(isWrongZeroFreightSnapshot(null, 100)).toBe(false);
    expect(isWrongZeroFreightSnapshot(520, 520)).toBe(false);
  });
});

describe("billingGapReasonLabel", () => {
  it("labels zero_amount_with_rate for guard display", () => {
    expect(billingGapReasonLabel("zero_amount_with_rate")).toBe(
      ZERO_AMOUNT_WITH_RATE_LABEL
    );
  });

  it("labels the new dual-payment gap reasons distinctly (not a generic fallback)", () => {
    expect(billingGapReasonLabel("dual_payment_missing_shipper_rate")).toBe(
      "双边收费：寄货人（主腿）费率未设定"
    );
    expect(billingGapReasonLabel("dual_payment_missing_secondary_rate")).toBe(
      "双边收费：WTL 收货人（副腿）费率未设定"
    );
    expect(billingGapReasonLabel("dual_payment_missing_both_rates")).toBe(
      "双边收费：两腿费率均未设定"
    );
  });
});
