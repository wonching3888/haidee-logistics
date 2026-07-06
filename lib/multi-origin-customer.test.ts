import { describe, expect, it } from "vitest";
import {
  assertOriginInCustomerList,
  buildMultiOriginCustomerStockLocations,
  charterCustomerOriginRequiredOnSave,
  filterMultiOriginDropdownOptions,
  parseOriginLocationNames,
  requiresCustomerOriginSelection,
  resolveCharterCustomerOrigin,
  selectableMultiOriginStockLocations,
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

  it("resolveCharterCustomerOrigin: create requires origin", () => {
    expect(
      resolveCharterCustomerOrigin("krabi", ["KRABI", "PHUKET"], {
        mode: "create",
      })
    ).toBe("KRABI");
    expect(() =>
      resolveCharterCustomerOrigin("", ["KRABI"], { mode: "create" })
    ).toThrow(/请选择标准产地/);
  });

  it("resolveCharterCustomerOrigin: edit with empty prior allows empty or fill", () => {
    expect(
      resolveCharterCustomerOrigin("", ["KRABI"], {
        mode: "edit",
        priorStored: null,
      })
    ).toBeNull();
    expect(
      resolveCharterCustomerOrigin("krabi", ["KRABI"], {
        mode: "edit",
        priorStored: "",
      })
    ).toBe("KRABI");
  });

  it("resolveCharterCustomerOrigin: edit with prior value cannot clear", () => {
    expect(
      resolveCharterCustomerOrigin("PHUKET", ["KRABI", "PHUKET"], {
        mode: "edit",
        priorStored: "KRABI",
      })
    ).toBe("PHUKET");
    expect(() =>
      resolveCharterCustomerOrigin("", ["KRABI"], {
        mode: "edit",
        priorStored: "KRABI",
      })
    ).toThrow(/不能清空/);
  });

  it("charterCustomerOriginRequiredOnSave follows create vs edit prior", () => {
    expect(
      charterCustomerOriginRequiredOnSave(true, "create", null)
    ).toBe(true);
    expect(
      charterCustomerOriginRequiredOnSave(true, "edit", null)
    ).toBe(false);
    expect(
      charterCustomerOriginRequiredOnSave(true, "edit", "KRABI")
    ).toBe(true);
    expect(
      charterCustomerOriginRequiredOnSave(false, "create", null)
    ).toBe(false);
  });

  it("filters blank names from multi-origin dropdown options", () => {
    expect(filterMultiOriginDropdownOptions(["CPN", "", "  ", "BS"])).toEqual([
      "CPN",
      "BS",
    ]);
  });

  it("merges standard origins with legacy stock locations", () => {
    const stock = new Map<string, Record<string, number>>([
      ["BS", { a: 5 }],
      ["RANONG", { a: 2 }],
      ["", { a: 3 }],
    ]);
    const empty = () => ({ a: 0, b: 0 });

    const merged = buildMultiOriginCustomerStockLocations(
      ["CPN"],
      stock,
      empty
    );

    expect(merged.map((row) => row.location)).toEqual(["CPN", "BS", "RANONG", ""]);
    expect(merged[0].quantities).toEqual({ a: 0, b: 0 });
    expect(merged[0].outsideStandardOrigin).toBe(false);
    expect(merged[1].outsideStandardOrigin).toBe(true);
    expect(selectableMultiOriginStockLocations(merged).map((r) => r.location)).toEqual([
      "CPN",
      "BS",
      "RANONG",
    ]);
  });

  it("omits zero-qty legacy locations outside standard list", () => {
    const stock = new Map<string, Record<string, number>>([
      ["KB", { a: 0, b: 0 }],
      ["RANONG", { a: 2 }],
      ["", { a: 0 }],
    ]);
    const empty = () => ({ a: 0, b: 0 });

    const merged = buildMultiOriginCustomerStockLocations(
      ["CPN", "RANONG"],
      stock,
      empty
    );

    expect(merged.map((row) => row.location)).toEqual(["CPN", "RANONG"]);
    expect(selectableMultiOriginStockLocations(merged).map((r) => r.location)).toEqual([
      "CPN",
      "RANONG",
    ]);
  });

  it("keeps zero-qty standard origins for first stock entry", () => {
    const stock = new Map<string, Record<string, number>>([["BS", { a: 5 }]]);
    const empty = () => ({ a: 0 });

    const merged = buildMultiOriginCustomerStockLocations(
      ["CPN", "BS"],
      stock,
      empty
    );

    expect(merged.map((row) => row.location)).toEqual(["CPN", "BS"]);
    expect(merged[0].quantities).toEqual({ a: 0 });
    expect(merged[1].quantities).toEqual({ a: 5 });
  });
});
