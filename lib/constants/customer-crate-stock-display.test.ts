import { describe, expect, it } from "vitest";
import {
  filterCrateTypesForCustomerStockDisplay,
  HIDDEN_CUSTOMER_CRATE_STOCK_TONG_TYPES,
} from "./customer-crate-stock-display";

describe("filterCrateTypesForCustomerStockDisplay", () => {
  const columns = [
    { id: "1", code: "ABB" },
    { id: "2", code: "GKS" },
    { id: "3", code: "WTL" },
    { id: "4", code: "GLY" },
    { id: "5", code: "BS" },
    { id: "6", code: "SHS" },
    { id: "7", code: "BHR" },
  ];

  it("excludes GKS, GLY, BS, SHS", () => {
    const visible = filterCrateTypesForCustomerStockDisplay(columns);
    expect(visible.map((c) => c.code)).toEqual(["ABB", "WTL", "BHR"]);
    expect(HIDDEN_CUSTOMER_CRATE_STOCK_TONG_TYPES).toEqual([
      "GKS",
      "GLY",
      "BS",
      "SHS",
    ]);
  });
});
