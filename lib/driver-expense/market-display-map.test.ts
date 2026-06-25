import { describe, expect, it } from "vitest";
import {
  feeMarketsForDisplayMarket,
  primaryFeeMarketForDisplay,
} from "@/lib/driver-expense/market-display-map";

describe("market-display-map", () => {
  it("maps KL display to KL-group fee markets", () => {
    expect(feeMarketsForDisplayMarket("KL")).toEqual(["KL", "BP", "MP", "SL"]);
  });

  it("maps BM Pindah display to per-trip unload markets", () => {
    expect(feeMarketsForDisplayMarket("BM Pindah")).toEqual([
      "P",
      "TP",
      "KT",
      "NT",
      "SA",
    ]);
  });

  it("maps direct markets 1:1", () => {
    expect(feeMarketsForDisplayMarket("MC")).toEqual(["MC"]);
  });

  it("picks first present primary market for merged groups", () => {
    expect(
      primaryFeeMarketForDisplay("KL", ["BP", "MP"])
    ).toBe("BP");
    expect(
      primaryFeeMarketForDisplay("BM Pindah", ["P", "TP"])
    ).toBe("P");
  });
});
