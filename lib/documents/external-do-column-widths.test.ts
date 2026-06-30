import { describe, expect, it } from "vitest";
import {
  externalDoColumnWidths,
  externalDoFixedColumnsWidthMm,
  EXTERNAL_DO_FIXED_COL_MM,
} from "@/lib/documents/external-do-column-widths";

describe("externalDoColumnWidths", () => {
  it("uses fixed mm widths for non-remarks columns (remarks fills remainder)", () => {
    const widths = externalDoColumnWidths(4);
    expect(widths.no).toBe("8mm");
    expect(widths.store).toBe("28mm");
    expect(widths.area).toBe("10mm");
    expect(widths.qty).toBe("14mm");
    expect(widths.crateEach).toBe("7mm");
    expect(externalDoFixedColumnsWidthMm(4)).toBe(
      EXTERNAL_DO_FIXED_COL_MM.no +
        EXTERNAL_DO_FIXED_COL_MM.store +
        EXTERNAL_DO_FIXED_COL_MM.area +
        EXTERNAL_DO_FIXED_COL_MM.crateEach * 4 +
        EXTERNAL_DO_FIXED_COL_MM.qty
    );
  });

  it("scales fixed width sum with active crate column count", () => {
    expect(externalDoFixedColumnsWidthMm(2)).toBe(74);
    expect(externalDoFixedColumnsWidthMm(4)).toBe(88);
  });
});
