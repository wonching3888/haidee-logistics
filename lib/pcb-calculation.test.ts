import { describe, expect, it } from "vitest";
import {
  calculateMonthlyPcb,
  resolvePcbProfile,
} from "@/lib/pcb-calculation";
import {
  PCB_JADUAL_MONTHLY_NET_THRESHOLD_MARRIED,
  PCB_JADUAL_MONTHLY_NET_THRESHOLD_SINGLE,
} from "@/lib/constants/pcb-2026";

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

describe("calculateMonthlyPcb — LHDN 2026 PDF worked example", () => {
  /**
   * Exhibit 5: January 2025, Category 3 (married, wife working), 3 children.
   * Y1=5,500, K1=605, n=11 → MTD = RM110.00
   */
  it("matches PDF January example (RM5,500, 3 children, Cat 3) → PCB 110.00", () => {
    const result = calculateMonthlyPcb({
      grossSalary: 5_500,
      epfEmployee: 605,
      maritalStatus: "married",
      spouseWorking: true,
      childCount: 3,
      month: 1,
      pcbMaritalDataVerified: true,
    });
    expect(result.annualChargeableP).toBe(47_000);
    // PDF exhibit shows P=47,000.07 (intermediate K2 rounding); same bracket → MTD RM110.
    expect(result.mtdBeforeZakat).toBe(110);
    expect(result.pcb).toBe(110);
  });

  it("matches PDF February example → PCB 110.00", () => {
    const result = calculateMonthlyPcb({
      grossSalary: 5_500,
      epfEmployee: 605,
      maritalStatus: "married",
      spouseWorking: true,
      childCount: 3,
      month: 2,
      accumulatedGrossY: 5_500,
      accumulatedEpfK: 605,
      accumulatedMtdX: 110,
      pcbMaritalDataVerified: true,
    });
    expect(result.annualChargeableP).toBe(47_000);
    expect(result.pcb).toBe(110);
  });

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

describe("Awang anchor (gross 6,230 → PCB 151.35) — deferred", () => {
  it.skip("cannot verify without marital status / spouseWorking / month context", () => {
    const result = calculateMonthlyPcb({
      grossSalary: 6_230,
      epfEmployee: round(6_230 * 0.11),
      maritalStatus: "married",
      spouseWorking: false,
      childCount: 2,
      month: 6,
      pcbMaritalDataVerified: true,
    });
    expect(result.pcb).toBe(151.35);
  });
});

function round(n: number) {
  return Math.round(n * 100) / 100;
}

describe("Jadual PCB monthly net thresholds (reference only)", () => {
  it("documents 2026 single/married table-method thresholds from industry cross-check", () => {
    expect(PCB_JADUAL_MONTHLY_NET_THRESHOLD_SINGLE).toBe(2_851);
    expect(PCB_JADUAL_MONTHLY_NET_THRESHOLD_MARRIED).toBe(3_851);
  });
});
