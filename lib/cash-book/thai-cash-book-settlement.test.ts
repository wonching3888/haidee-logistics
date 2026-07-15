import { describe, expect, it } from "vitest";
import {
  buildDriverTripLineParticulars,
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
    expect(result.songkhlaAmountThb).toBe(1400);
    expect(result.pattaniAmountThb).toBe(1200);
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
  it("includes date, station, and qty for handling", () => {
    expect(
      buildHandlingParticulars("2026-07-14", "SADAO", {
        crateQty: 10,
        boxQty: 2,
      })
    ).toBe("2026-07-14 / SADAO / 搬运费 / 桶 10 盒 2");
    expect(
      buildHandlingParticulars("2026-07-14", "SONGKHLA", {
        crateQty: 5,
        boxQty: 0,
      })
    ).toContain("桶 5");
  });

  it("includes destination on each trip wage line", () => {
    expect(
      buildDriverTripLineParticulars("2026-07-14", "其他", "SONGKHLA")
    ).toBe("2026-07-14 / 其他 / 趟次 / SONGKHLA");
    expect(
      buildDriverTripLineParticulars("2026-07-14", "其他", "PATTANI")
    ).toBe("2026-07-14 / 其他 / 趟次 / PATTANI");
  });

  it("keeps legacy trip header helper", () => {
    expect(buildDriverTripParticulars("2026-07-14", "其他")).toBe(
      "2026-07-14 / 其他 / 趟次工资"
    );
  });
});
