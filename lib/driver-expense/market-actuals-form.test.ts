import { describe, expect, it } from "vitest";
import {
  buildMarketActualInputsFromForm,
  hydrateMarketActualFormMap,
  marketActualFormKey,
  sumMarketActualFormValues,
} from "@/lib/driver-expense/market-actuals-form";
import type { VoucherPrintBreakdown } from "@/lib/driver-expense/voucher-utils";

const breakdown: VoucherPrintBreakdown = {
  parking: [
    { market: "BM", suggested: 10 },
    { market: "MC", suggested: 20 },
  ],
  kpb: [{ market: "BM", suggested: 5 }],
  upahTurun: [
    { market: "BM", suggested: 50 },
    { market: "MC", suggested: 100 },
  ],
  upahNaikTongLabel: "Upah Naik Tong",
  upahNaikTongSuggested: 0,
};

describe("market-actuals-form", () => {
  it("sums per fee type from form map", () => {
    const map = {
      [marketActualFormKey("parking", "BM")]: "10",
      [marketActualFormKey("parking", "MC")]: "20",
    };
    expect(sumMarketActualFormValues(map, "parking")).toBe(30);
    expect(sumMarketActualFormValues(map, "kpb")).toBeNull();
  });

  it("hydrates legacy scalar onto last market row", () => {
    const map = hydrateMarketActualFormMap(breakdown, [], {
      parkingActual: 30,
      kpbActual: 5,
      upahTurunActual: 150,
    });
    expect(map[marketActualFormKey("parking", "MC")]).toBe("30");
    expect(map[marketActualFormKey("kpb", "BM")]).toBe("5");
    expect(map[marketActualFormKey("unload", "MC")]).toBe("150");
  });

  it("builds API inputs for all breakdown rows", () => {
    const map = {
      [marketActualFormKey("unload", "BM")]: "55",
      [marketActualFormKey("unload", "MC")]: "",
    };
    const items = buildMarketActualInputsFromForm(map, breakdown);
    expect(items).toContainEqual({
      feeType: "unload",
      displayMarket: "BM",
      amount: 55,
    });
    expect(items).toContainEqual({
      feeType: "unload",
      displayMarket: "MC",
      amount: null,
    });
  });

  it("includes KL kpb row when suggested is 0", () => {
    const bd: VoucherPrintBreakdown = {
      ...breakdown,
      kpb: [{ market: "KL", suggested: 0 }],
    };
    const items = buildMarketActualInputsFromForm(
      { [marketActualFormKey("kpb", "KL")]: "12.5" },
      bd
    );
    expect(items).toContainEqual({
      feeType: "kpb",
      displayMarket: "KL",
      amount: 12.5,
    });
  });
});
