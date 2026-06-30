import { describe, expect, it } from "vitest";
import {
  externalDoColumnPercents,
  externalDoColumnTotalPercent,
  externalDoUsesDenseCrateColumns,
  EXTERNAL_DO_COL,
} from "@/lib/documents/external-do-column-widths";

describe("externalDoColumnPercents", () => {
  it("sums to 100% with four crate columns (KL-style)", () => {
    const w = externalDoColumnPercents(4);
    expect(w.remarks).toBe(EXTERNAL_DO_COL.remarksTarget);
    expect(w.crateEach).toBeCloseTo(7.25, 2);
    expect(externalDoColumnTotalPercent(4)).toBeCloseTo(100, 5);
  });

  it("shrinks remarks and enforces min crate width with eight columns (BM/PENANG-style)", () => {
    const w = externalDoColumnPercents(8);
    expect(w.crateEach).toBeGreaterThanOrEqual(EXTERNAL_DO_COL.crateMinPercent);
    expect(w.remarks).toBeGreaterThanOrEqual(EXTERNAL_DO_COL.remarksMin);
    expect(w.remarks).toBeLessThanOrEqual(EXTERNAL_DO_COL.remarksTarget);
    expect(externalDoColumnTotalPercent(8)).toBeCloseTo(100, 5);
  });

  it("flags dense crate styling at 7+ columns", () => {
    expect(externalDoUsesDenseCrateColumns(6)).toBe(false);
    expect(externalDoUsesDenseCrateColumns(7)).toBe(true);
    expect(externalDoUsesDenseCrateColumns(8)).toBe(true);
  });
});
