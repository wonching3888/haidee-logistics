import { describe, expect, it } from "vitest";
import {
  parseMarketCodesParam,
  parseSearchFiltersFromParams,
  searchFiltersToUrlParams,
  sortMarketCodes,
} from "./search-filters";

describe("search-filters", () => {
  it("parses market codes from comma-separated param in MARKET_ORDER", () => {
    expect(parseMarketCodesParam("MC,KL,INVALID")).toEqual(["KL", "MC"]);
  });

  it("sorts market codes by standard order", () => {
    expect(sortMarketCodes(["JB", "KL", "BP"])).toEqual(["KL", "BP", "JB"]);
  });

  it("maps legacy q param to keyword", () => {
    const filters = parseSearchFiltersFromParams({
      from: "2026-06-01",
      to: "2026-06-02",
      q: "备注",
    });
    expect(filters.keyword).toBe("备注");
  });

  it("round-trips URL params", () => {
    const filters = parseSearchFiltersFromParams({
      from: "2026-06-01",
      to: "2026-06-02",
      shipperId: "abc",
      receiver: "F40",
      market: "KL,MC",
      tongTypeId: "t1",
      plate: "PKS",
      docNo: "IN-2026",
      keyword: "toy",
    });
    const params = searchFiltersToUrlParams(filters);
    expect(params.get("receiver")).toBe("F40");
    expect(params.get("market")).toBe("KL,MC");
    expect(params.get("keyword")).toBe("toy");
    expect(params.has("q")).toBe(false);
  });
});
