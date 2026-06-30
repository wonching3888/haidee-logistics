import { describe, expect, it } from "vitest";
import {
  buildFreightRateFieldWrites,
  hasFreightRateFieldWrites,
  parseOptionalRateField,
} from "@/lib/freight-rate-save";

describe("freight-rate-save", () => {
  it("empty input is undefined (skip upsert field)", () => {
    expect(parseOptionalRateField("")).toBeUndefined();
    expect(parseOptionalRateField("  ")).toBeUndefined();
    expect(parseOptionalRateField("220")).toBe(220);
  });

  it("update only writes provided fields", () => {
    const { create, update } = buildFreightRateFieldWrites({
      marketId: "m1",
      rateTong: 220,
    });
    expect(create).toEqual({ rateTong: 220, rateBox: null });
    expect(update).toEqual({ rateTong: 220 });
    expect(update.rateBox).toBeUndefined();
  });

  it("skips markets with no field writes", () => {
    expect(hasFreightRateFieldWrites({ marketId: "m1" })).toBe(false);
    expect(
      hasFreightRateFieldWrites({ marketId: "m1", rateBox: 140 })
    ).toBe(true);
  });
});
