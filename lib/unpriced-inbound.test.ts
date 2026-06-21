import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isWrongZeroFreightSnapshot } from "@/lib/inbound-freight";
import {
  billingGapReasonLabel,
  ZERO_AMOUNT_WITH_RATE_LABEL,
} from "@/lib/unpriced-inbound";

describe("isWrongZeroFreightSnapshot", () => {
  it("flags stored zero when recompute is positive", () => {
    assert.equal(isWrongZeroFreightSnapshot(0, 1460), true);
  });

  it("ignores legitimate zero when recompute is also zero", () => {
    assert.equal(isWrongZeroFreightSnapshot(0, 0), false);
    assert.equal(isWrongZeroFreightSnapshot(0, null), false);
  });

  it("ignores null or positive stored amounts", () => {
    assert.equal(isWrongZeroFreightSnapshot(null, 100), false);
    assert.equal(isWrongZeroFreightSnapshot(520, 520), false);
  });
});

describe("billingGapReasonLabel", () => {
  it("labels zero_amount_with_rate for guard display", () => {
    assert.equal(
      billingGapReasonLabel("zero_amount_with_rate"),
      ZERO_AMOUNT_WITH_RATE_LABEL
    );
  });
});
