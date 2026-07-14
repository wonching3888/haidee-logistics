import { describe, expect, it } from "vitest";
import {
  buildDriverTripParticulars,
  buildHandlingParticulars,
  computeThaiDriverTripSettlementAmount,
} from "@/lib/cash-book/thai-cash-book-settlement";

describe("computeThaiDriverTripSettlementAmount", () => {
  it("sums Songkhla+Pattani trip pay only (no allowance)", () => {
    const result = computeThaiDriverTripSettlementAmount({
      songkhlaTripCount: 2,
      pattaniTripCount: 1,
      driverTripSongkhla: 700,
      driverTripPattani: 1200,
    });
    expect(result.tripCommissionThb).toBe(2600);
    expect(result.amountThb).toBe(2600);
  });

  it("returns zero when no trips", () => {
    const result = computeThaiDriverTripSettlementAmount({
      songkhlaTripCount: 0,
      pattaniTripCount: 0,
      driverTripSongkhla: 700,
      driverTripPattani: 1200,
    });
    expect(result.amountThb).toBe(0);
  });
});

describe("particulars builders", () => {
  it("includes date and station for handling", () => {
    expect(buildHandlingParticulars("2026-07-14", "SADAO")).toContain("SADAO");
    expect(buildHandlingParticulars("2026-07-14", "SONGKHLA")).toContain(
      "Songkhla"
    );
  });

  it("includes date and driver for trip wages", () => {
    expect(buildDriverTripParticulars("2026-07-14", "其他")).toBe(
      "2026-07-14 / 其他 / 趋次工资"
    );
  });
});
