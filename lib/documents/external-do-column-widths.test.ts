import { describe, expect, it } from "vitest";
import {
  externalDoColumnPercents,
  externalDoColumnTotalPercent,
} from "@/lib/documents/external-do-column-widths";

describe("externalDoColumnPercents", () => {
  it("allocates remarks at 40% with four crate columns", () => {
    const widths = externalDoColumnPercents(4);
    expect(widths.remarks).toBe(40);
    expect(widths.store).toBe(14);
    expect(widths.qty).toBe(10);
    expect(widths.no).toBe(4);
    expect(widths.area).toBe(5);
    expect(widths.crateEach).toBeCloseTo(6.75, 2);
    expect(externalDoColumnTotalPercent(4)).toBeCloseTo(100, 5);
  });

  it("narrows crate columns when fewer active types", () => {
    const widths = externalDoColumnPercents(2);
    expect(widths.crateEach).toBeCloseTo(13.5, 2);
    expect(externalDoColumnTotalPercent(2)).toBeCloseTo(100, 5);
  });
});
