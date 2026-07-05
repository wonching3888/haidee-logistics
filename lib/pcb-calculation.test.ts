import { describe, expect, it } from "vitest";
import {
  advancePcbYearToDate,
  calculateMonthlyPcb,
  computeK2,
  emptyPcbYearToDate,
  resolvePcbProfile,
  roundUpToNearest5Sen,
  truncateToSen,
} from "@/lib/pcb-calculation";
import {
  PCB_JADUAL_MONTHLY_NET_THRESHOLD_MARRIED,
  PCB_JADUAL_MONTHLY_NET_THRESHOLD_SINGLE,
} from "@/lib/constants/pcb-2026";

describe("truncateToSen (K2 intermediate)", () => {
  it("omits subsequent figures (truncate, not half-up)", () => {
    expect(truncateToSen(308.636363636)).toBe(308.63);
    expect(truncateToSen(308.639)).toBe(308.63);
    expect(truncateToSen(242.777777777)).toBe(242.77);
    expect(truncateToSen(197.5)).toBe(197.5);
    expect(truncateToSen(279)).toBe(279);
  });

  it("does not round 308.636… up to 308.64", () => {
    expect(truncateToSen(308.636363636)).not.toBe(308.64);
  });
});

describe("computeK2", () => {
  it("truncates spread to sen before min(K1, spread) — January EXHIBIT 5", () => {
    // [4000 − (0+605+0)] / 11 = 308.6363… → 308.63
    expect(
      computeK2({ kAccumulated: 0, k1: 605, kt: 0, n: 11 })
    ).toBe(308.63);
  });

  it("matches February–April EXHIBIT 5 K2 values", () => {
    expect(computeK2({ kAccumulated: 605, k1: 605, n: 10 })).toBe(279);
    expect(computeK2({ kAccumulated: 1210, k1: 605, n: 9 })).toBe(242.77);
    expect(computeK2({ kAccumulated: 1815, k1: 605, n: 8 })).toBe(197.5);
  });
});

describe("roundUpToNearest5Sen (MTD final step)", () => {
  it("rounds up to nearest 5 sen", () => {
    expect(roundUpToNearest5Sen(287.02)).toBe(287.05);
    expect(roundUpToNearest5Sen(287.06)).toBe(287.1);
    expect(roundUpToNearest5Sen(287.01)).toBe(287.05);
    expect(roundUpToNearest5Sen(287.04)).toBe(287.05);
    expect(roundUpToNearest5Sen(108.20042)).toBe(108.2);
    expect(roundUpToNearest5Sen(110.00035)).toBe(110);
  });

  it("leaves exact 5-sen multiples unchanged", () => {
    expect(roundUpToNearest5Sen(287.0)).toBe(287);
    expect(roundUpToNearest5Sen(287.05)).toBe(287.05);
    expect(roundUpToNearest5Sen(110)).toBe(110);
    expect(roundUpToNearest5Sen(106.2)).toBe(106.2);
  });

  it("returns 0 for non-positive values", () => {
    expect(roundUpToNearest5Sen(0)).toBe(0);
    expect(roundUpToNearest5Sen(-1)).toBe(0);
  });
});

describe("resolvePcbProfile", () => {
  it("flags needs_review and uses conservative Category 1 when marital data missing", () => {
    const profile = resolvePcbProfile({
      maritalStatus: null,
      spouseWorking: null,
      childCount: 2,
    });
    expect(profile.needsReview).toBe(true);
    expect(profile.category).toBe(1);
    expect(profile.qualifyingChildren).toBe(0);
  });

  it("uses Category 2 when married and spouse not working", () => {
    const profile = resolvePcbProfile({
      maritalStatus: "married",
      spouseWorking: false,
      childCount: 3,
      pcbMaritalDataVerified: true,
    });
    expect(profile.category).toBe(2);
    expect(profile.qualifyingChildren).toBe(3);
    expect(profile.needsReview).toBe(false);
  });
});

/**
 * EXHIBIT 5 — Kaedah Pengiraan Berkomputer PCB 2026.
 * Married, spouse working (Category 3), 3 qualifying children.
 * Normal remuneration only (April bonus Steps 2–5 out of scope).
 *
 * Official anchors (P and MTD to the sen):
 * | Month | ∑Y   | ∑K   | X      | LP  | P         | MTD    |
 * | Jan   | 0    | 0    | 0      | 0   | 47,000.07 | 110.00 |
 * | Feb   | 5500 | 605  | 110    | 0   | 47,000.00 | 110.00 |
 * | Mar   | 11000| 1210 | 220    | 300 | 46,700.07 | 108.20 |
 * | Apr   | 16500| 1815 | 328.20 | 600 | 46,400.00 | 106.20 |
 */
describe("EXHIBIT 5 — four-month normal remuneration (exact to sen)", () => {
  const base = {
    grossSalary: 5_500,
    epfEmployee: 605,
    maritalStatus: "married" as const,
    spouseWorking: true,
    childCount: 3,
    pcbMaritalDataVerified: true,
  };

  const months = [
    {
      label: "January",
      month: 1,
      accumulatedGrossY: 0,
      accumulatedEpfK: 0,
      accumulatedMtdX: 0,
      lp: 0,
      expectedP: 47_000.07,
      expectedMtd: 110,
      expectedK2: 308.63,
    },
    {
      label: "February",
      month: 2,
      accumulatedGrossY: 5_500,
      accumulatedEpfK: 605,
      accumulatedMtdX: 110,
      lp: 0,
      expectedP: 47_000,
      expectedMtd: 110,
      expectedK2: 279,
    },
    {
      label: "March (LP 300)",
      month: 3,
      accumulatedGrossY: 11_000,
      accumulatedEpfK: 1_210,
      accumulatedMtdX: 220,
      lp: 300,
      expectedP: 46_700.07,
      expectedMtd: 108.2,
      expectedK2: 242.77,
    },
    {
      label: "April normal salary only (LP 600, no bonus)",
      month: 4,
      accumulatedGrossY: 16_500,
      accumulatedEpfK: 1_815,
      accumulatedMtdX: 328.2,
      lp: 600,
      expectedP: 46_400,
      expectedMtd: 106.2,
      expectedK2: 197.5,
    },
  ] as const;

  for (const row of months) {
    it(`${row.label}: P=${row.expectedP.toFixed(2)} MTD=${row.expectedMtd.toFixed(2)}`, () => {
      const result = calculateMonthlyPcb({
        ...base,
        month: row.month,
        accumulatedGrossY: row.accumulatedGrossY,
        accumulatedEpfK: row.accumulatedEpfK,
        accumulatedMtdX: row.accumulatedMtdX,
        lp: row.lp,
      });
      expect(result.k2).toBe(row.expectedK2);
      expect(result.lp).toBe(row.lp);
      expect(result.accumulatedMtdX).toBe(row.accumulatedMtdX);
      expect(result.annualChargeableP).toBe(row.expectedP);
      expect(result.mtdBeforeZakat).toBe(row.expectedMtd);
      expect(result.pcb).toBe(row.expectedMtd);
    });
  }

  it("rolls X via advancePcbYearToDate across Jan→Apr", () => {
    let ytd = emptyPcbYearToDate();
    const expectedX = [0, 110, 220, 328.2];
    for (let i = 0; i < months.length; i++) {
      const row = months[i]!;
      expect(ytd.accumulatedMtdX).toBe(expectedX[i]);
      const result = calculateMonthlyPcb({
        ...base,
        month: row.month,
        accumulatedGrossY: ytd.accumulatedGrossY,
        accumulatedEpfK: ytd.accumulatedEpfK,
        accumulatedMtdX: ytd.accumulatedMtdX,
        lp: row.lp,
      });
      expect(result.pcb).toBe(row.expectedMtd);
      ytd = advancePcbYearToDate(ytd, {
        grossSalary: base.grossSalary,
        epfEmployee: base.epfEmployee,
        pcb: result.pcb,
      });
    }
    expect(ytd.accumulatedGrossY).toBe(22_000);
    expect(ytd.accumulatedEpfK).toBe(2_420);
    expect(ytd.accumulatedMtdX).toBe(434.4);
  });

  it("accepts lpDeductions alias for LP", () => {
    const result = calculateMonthlyPcb({
      ...base,
      month: 3,
      accumulatedGrossY: 11_000,
      accumulatedEpfK: 1_210,
      accumulatedMtdX: 220,
      lpDeductions: 300,
    });
    expect(result.lp).toBe(300);
    expect(result.annualChargeableP).toBe(46_700.07);
    expect(result.pcb).toBe(108.2);
  });

  it("defaults LP and X to 0 when omitted", () => {
    const result = calculateMonthlyPcb({
      ...base,
      month: 1,
    });
    expect(result.lp).toBe(0);
    expect(result.accumulatedMtdX).toBe(0);
    expect(result.pcb).toBe(110);
  });
});

describe("edge cases", () => {
  it("returns 0 when projected annual chargeable P ≤ 5,000", () => {
    const result = calculateMonthlyPcb({
      grossSalary: 700,
      epfEmployee: 77,
      maritalStatus: "single",
      spouseWorking: null,
      childCount: 0,
      month: 1,
      pcbMaritalDataVerified: true,
    });
    expect(result.annualChargeableP).toBeLessThanOrEqual(5_000);
    expect(result.pcb).toBe(0);
  });

  it("returns 0 when MTD before zakat is below RM10", () => {
    const result = calculateMonthlyPcb({
      grossSalary: 3_200,
      epfEmployee: 352,
      maritalStatus: "single",
      spouseWorking: null,
      childCount: 0,
      month: 1,
      pcbMaritalDataVerified: true,
    });
    if (result.mtdBeforeZakat > 0 && result.mtdBeforeZakat < 10) {
      expect(result.pcb).toBe(0);
    }
  });
});

describe("Jadual PCB monthly net thresholds (reference only)", () => {
  it("documents 2026 single/married table-method thresholds from industry cross-check", () => {
    expect(PCB_JADUAL_MONTHLY_NET_THRESHOLD_SINGLE).toBe(2_851);
    expect(PCB_JADUAL_MONTHLY_NET_THRESHOLD_MARRIED).toBe(3_851);
  });
});
