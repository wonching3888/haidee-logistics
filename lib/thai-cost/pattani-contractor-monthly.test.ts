import { describe, expect, it } from "vitest";
import { computePattaniContractorMonthlySummary } from "@/lib/thai-cost/pattani-contractor-monthly";

describe("computePattaniContractorMonthlySummary", () => {
  it("sums crates×20 + boxes×5 across days", () => {
    const summary = computePattaniContractorMonthlySummary({
      year: 2026,
      month: 7,
      crateRate: 20,
      boxRate: 5,
      days: [
        { date: "2026-07-01", crateQty: 10, boxQty: 4 },
        { date: "2026-07-02", crateQty: 5, boxQty: 2 },
      ],
    });
    expect(summary.totalCrates).toBe(15);
    expect(summary.totalBoxes).toBe(6);
    expect(summary.totalContractorThb).toBe(15 * 20 + 6 * 5);
    expect(summary.days[0].contractorThb).toBe(220);
  });
});
