import { describe, expect, it } from "vitest";
import {
  crateExportLineShortage,
  resolveCrateExportQuantitySuggested,
} from "@/lib/crate-export-line-math";

describe("crate-export-line-math", () => {
  it("crateExportLineShortage uses original suggested minus actual", () => {
    expect(crateExportLineShortage(50, 50)).toBe(0);
    expect(crateExportLineShortage(50, 30)).toBe(20);
    expect(crateExportLineShortage(0, 10)).toBe(0);
  });

  it("uses form suggested when server live is not provided", () => {
    expect(
      resolveCrateExportQuantitySuggested({
        formQuantitySuggested: 42,
      })
    ).toBe(42);
  });

  it("save path uses server live suggested when provided (create and edit)", () => {
    expect(
      resolveCrateExportQuantitySuggested({
        formQuantitySuggested: 0,
        liveQuantitySuggested: 124,
      })
    ).toBe(124);
    expect(
      resolveCrateExportQuantitySuggested({
        formQuantitySuggested: 5,
        liveQuantitySuggested: 35,
      })
    ).toBe(35);
    expect(
      resolveCrateExportQuantitySuggested({
        formQuantitySuggested: 99,
        liveQuantitySuggested: 0,
      })
    ).toBe(0);
  });

  it("edit save: live suggested reflects current owed; shortage uses that value", () => {
    const suggested = resolveCrateExportQuantitySuggested({
      formQuantitySuggested: 5,
      liveQuantitySuggested: 35,
    });
    expect(suggested).toBe(35);
    expect(crateExportLineShortage(suggested, 35)).toBe(0);
    expect(crateExportLineShortage(suggested, 30)).toBe(5);
  });
});
