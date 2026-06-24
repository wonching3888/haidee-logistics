import { describe, expect, it } from "vitest";
import {
  parseMarketCodesParam,
  parseSearchFiltersFromParams,
  searchFiltersToUrlParams,
} from "./search-filters";

describe("search-filters", () => {
  it("parses market codes from comma-separated param", () => {
    expect(parseMarketCodesParam("KL,mc,INVALID")).toEqual(["KL", "MC"]);
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
      market: "KL,MC",
      tongTypeId: "t1",
      plate: "PKS",
      docNo: "IN-2026",
      keyword: "toy",
    });
    const params = searchFiltersToUrlParams(filters);
    expect(params.get("market")).toBe("KL,MC");
    expect(params.get("keyword")).toBe("toy");
    expect(params.has("q")).toBe(false);
  });
});
