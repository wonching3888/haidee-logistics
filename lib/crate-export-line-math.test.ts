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

  it("create path uses form suggested", () => {
    expect(
      resolveCrateExportQuantitySuggested({
        isEdit: false,
        tongTypeId: "t1",
        formQuantitySuggested: 42,
      })
    ).toBe(42);
  });

  it("edit path ignores form and uses preserved DB suggested", () => {
    const preserved = { t1: 50, t2: 12 };
    expect(
      resolveCrateExportQuantitySuggested({
        isEdit: true,
        tongTypeId: "t1",
        formQuantitySuggested: 0,
        preservedByTongTypeId: preserved,
      })
    ).toBe(50);
    expect(
      resolveCrateExportQuantitySuggested({
        isEdit: true,
        tongTypeId: "t2",
        formQuantitySuggested: 99,
        preservedByTongTypeId: preserved,
      })
    ).toBe(12);
  });

  it("today edit: suggested stays 50 after live owed drops to 0, shortage reflects edit", () => {
    const preserved = { abb: 50 };
    const suggested = resolveCrateExportQuantitySuggested({
      isEdit: true,
      tongTypeId: "abb",
      formQuantitySuggested: 0,
      preservedByTongTypeId: preserved,
    });
    expect(suggested).toBe(50);

    const shortageAfterFullReturn = crateExportLineShortage(suggested, 50);
    expect(shortageAfterFullReturn).toBe(0);

    const shortageAfterPartialEdit = crateExportLineShortage(suggested, 30);
    expect(shortageAfterPartialEdit).toBe(20);
  });
});
