import { describe, expect, it } from "vitest";
import {
  assertOriginInCustomerList,
  parseOriginLocationNames,
  requiresCustomerOriginSelection,
} from "@/lib/multi-origin-customer";

describe("multi-origin-customer", () => {
  it("requires origin only for multi-origin on SADAO pickup", () => {
    expect(requiresCustomerOriginSelection(true, "SADAO")).toBe(true);
    expect(requiresCustomerOriginSelection(true, "SONGKHLA")).toBe(false);
    expect(requiresCustomerOriginSelection(false, "SADAO")).toBe(false);
  });

  it("parses and dedupes origin names", () => {
    expect(parseOriginLocationNames([" KRABI ", "krabi", "N&K"])).toEqual([
      "KRABI",
      "N&K",
    ]);
  });

  it("validates origin against customer list case-insensitively", () => {
    expect(
      assertOriginInCustomerList("phuket", ["KRABI", "PHUKET"])
    ).toBe("PHUKET");
    expect(() =>
      assertOriginInCustomerList("", ["KRABI"])
    ).toThrow(/请选择标准产地/);
  });
});
