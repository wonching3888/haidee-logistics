/**
 * LHDN MTD (PCB) computerized calculation — draft formula engine (NOT production).
 *
 * Intentionally not called from lib/payroll-statutory.ts payslip/JV paths until
 * accounting signs off. Use lib/pcb-calculation.test.ts + EXHIBIT 5 to verify fixes.
 *
 * Known gaps before production enablement:
 * - K2: spread must truncate to sen (omit subsequent figures) before min(K1, spread)
 * - MTD: final amount rounds UP to nearest 5 sen per LHDN spec (not half-up to cent)
 * - X: accumulated MTD paid (∑ prior months) — no roll-forward from payroll history yet
 * - LP: TP1 deductions (∑LP + LP1) — field exists on input but not wired from payroll
 * - April bonus: Additional Remuneration formula (EXHIBIT 5 Steps 2–5) not implemented
 * - Y/K opening balance: mid-year go-live needs real Jan–(m−1) gross/EPF or TP3 import
 *
 * @see lib/constants/pcb-2026.ts
 * @see scripts/_output/spesifikasi-pcb-2026.pdf EXHIBIT 5
 */
import type { MaritalStatus } from "@/lib/constants/payroll";
import {
  PCB_CHILD_RELIEF_PER_CHILD,
  PCB_EPF_ANNUAL_CAP,
  PCB_INDIVIDUAL_RELIEF_ANNUAL,
  PCB_MINIMUM_DEDUCTION,
  PCB_SPOUSE_RELIEF_ANNUAL,
  PCB_TAX_BRACKETS_2026,
  type PcbEmployeeCategory,
} from "@/lib/constants/pcb-2026";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export interface PcbProfile {
  category: PcbEmployeeCategory;
  qualifyingChildren: number;
  needsReview: boolean;
  reviewReasons: string[];
}

export interface MonthlyPcbInput {
  /** Gross normal remuneration for current month (Y1). */
  grossSalary: number;
  /** EPF employee contribution for current month (K1). */
  epfEmployee: number;
  maritalStatus: MaritalStatus | null | undefined;
  /** Married only: true = spouse working (Category 3). */
  spouseWorking: boolean | null | undefined;
  childCount: number;
  /** Payroll calendar month 1–12. */
  month: number;
  /** Accumulated gross Y before current month (default 0). */
  accumulatedGrossY?: number;
  /** Accumulated EPF K before current month (default 0). */
  accumulatedEpfK?: number;
  /** Accumulated MTD paid X before current month (default 0). */
  accumulatedMtdX?: number;
  /** Accumulated zakat Z before current month (default 0). */
  accumulatedZakatZ?: number;
  /** Optional TP1 deductions ∑LP + LP1 for current month (default 0). */
  lpDeductions?: number;
  /** Additional remuneration net (Yt-Kt) for current month (default 0). */
  additionalRemunerationNet?: number;
  /** Zakat for current month (default 0). */
  currentMonthZakat?: number;
  /** When false, treat incomplete marital data as single (conservative). */
  pcbMaritalDataVerified?: boolean;
}

export interface MonthlyPcbResult {
  pcb: number;
  annualChargeableP: number;
  annualTax: number;
  mtdBeforeZakat: number;
  profile: PcbProfile;
}

/** Resolve PCB category + conservative defaults when master data incomplete. */
export function resolvePcbProfile(input: {
  maritalStatus: MaritalStatus | null | undefined;
  spouseWorking: boolean | null | undefined;
  childCount: number;
  pcbMaritalDataVerified?: boolean;
}): PcbProfile {
  const reasons: string[] = [];
  const verified = input.pcbMaritalDataVerified === true;
  const childCount = Math.max(0, input.childCount);

  if (!verified) {
    if (!input.maritalStatus) {
      reasons.push("marital_status_missing");
    }
    if (input.maritalStatus === "married" && input.spouseWorking == null) {
      reasons.push("spouse_working_missing");
    }
  }

  const needsReview = reasons.length > 0;

  if (needsReview) {
    return {
      category: 1,
      qualifyingChildren: 0,
      needsReview: true,
      reviewReasons: reasons,
    };
  }

  if (input.maritalStatus === "married") {
    if (input.spouseWorking) {
      return {
        category: 3,
        qualifyingChildren: childCount,
        needsReview: false,
        reviewReasons: [],
      };
    }
    return {
      category: 2,
      qualifyingChildren: childCount,
      needsReview: false,
      reviewReasons: [],
    };
  }

  return {
    category: childCount > 0 ? 3 : 1,
    qualifyingChildren: childCount > 0 ? childCount : 0,
    needsReview: false,
    reviewReasons: [],
  };
}

function epfReliefs(input: {
  category: PcbEmployeeCategory;
  qualifyingChildren: number;
}): { d: number; s: number; qc: number } {
  const d = PCB_INDIVIDUAL_RELIEF_ANNUAL;
  let s = 0;
  let qc = 0;

  if (input.category === 2) {
    s = PCB_SPOUSE_RELIEF_ANNUAL;
    qc = input.qualifyingChildren * PCB_CHILD_RELIEF_PER_CHILD;
  } else if (input.category === 3) {
    qc = input.qualifyingChildren * PCB_CHILD_RELIEF_PER_CHILD;
  }

  return { d, s, qc };
}

function computeK2(input: {
  kAccumulated: number;
  k1: number;
  kt: number;
  n: number;
}): number {
  const remainingCap = Math.max(
    0,
    PCB_EPF_ANNUAL_CAP - input.kAccumulated - input.k1 - input.kt
  );
  const spread = input.n > 0 ? remainingCap / input.n : 0;
  return Math.min(input.k1, spread);
}

function annualTaxFromP(p: number, category: PcbEmployeeCategory): number {
  if (p <= 5_000) return 0;

  for (const bracket of PCB_TAX_BRACKETS_2026) {
    if (p <= bracket.maxP) {
      const b =
        category === 2 ? bracket.bCat2 : bracket.bCat1And3;
      const tax = ((p - bracket.m) * bracket.r) / 100 + b;
      return Math.max(0, roundMoney(tax));
    }
  }
  return 0;
}

/**
 * LHDN normal remuneration MTD (PCB) — computerized calculation method 2026.
 * MTD = [(P – M) × R + B – (Z + X)] / (n + 1)
 */
export function calculateMonthlyPcb(input: MonthlyPcbInput): MonthlyPcbResult {
  const profile = resolvePcbProfile({
    maritalStatus: input.maritalStatus,
    spouseWorking: input.spouseWorking,
    childCount: input.childCount,
    pcbMaritalDataVerified: input.pcbMaritalDataVerified,
  });

  const month = Math.min(12, Math.max(1, Math.round(input.month)));
  const n = 12 - month;
  const y1 = Math.max(0, input.grossSalary);
  const k1 = Math.max(0, input.epfEmployee);
  const y2 = y1;
  const yAccum = Math.max(0, input.accumulatedGrossY ?? 0);
  const kAccum = Math.max(0, input.accumulatedEpfK ?? 0);
  const x = Math.max(0, input.accumulatedMtdX ?? 0);
  const z = Math.max(0, input.accumulatedZakatZ ?? 0);
  const lp = Math.max(0, input.lpDeductions ?? 0);
  const ytKt = input.additionalRemunerationNet ?? 0;
  const kt = 0;

  const k2 = computeK2({
    kAccumulated: kAccum,
    k1,
    kt,
    n,
  });

  const sumYK = yAccum - kAccum;
  const y1Net = y1 - k1;
  const y2Net = y2 - k2;
  const projected = sumYK + y1Net + y2Net * n + ytKt;

  const { d, s, qc } = epfReliefs(profile);
  const annualChargeableP = roundMoney(projected - (d + s + qc + lp));
  const annualTax = annualTaxFromP(annualChargeableP, profile.category);

  const bracket = PCB_TAX_BRACKETS_2026.find((b) => annualChargeableP <= b.maxP);
  const m = bracket?.m ?? 0;
  const r = bracket?.r ?? 0;
  const bVal =
    profile.category === 2 ? bracket?.bCat2 ?? 0 : bracket?.bCat1And3 ?? 0;

  const mtdNumerator =
    ((annualChargeableP - m) * r) / 100 + bVal - (z + x);
  const mtdBeforeZakat = roundMoney(mtdNumerator / (n + 1));

  let pcb = 0;
  if (mtdBeforeZakat >= PCB_MINIMUM_DEDUCTION) {
    const netMtd = roundMoney(
      Math.max(0, mtdBeforeZakat - (input.currentMonthZakat ?? 0))
    );
    pcb = netMtd >= PCB_MINIMUM_DEDUCTION ? netMtd : 0;
  }

  return {
    pcb,
    annualChargeableP,
    annualTax,
    mtdBeforeZakat,
    profile,
  };
}

/** Estimate YTD gross/EPF for months before current (uniform salary assumption). */
export function estimatePayrollYtdForPcb(input: {
  grossSalary: number;
  epfEmployee: number;
  month: number;
}) {
  const prior = Math.max(0, Math.min(11, Math.round(input.month) - 1));
  return {
    accumulatedGrossY: roundMoney(prior * input.grossSalary),
    accumulatedEpfK: roundMoney(prior * input.epfEmployee),
  };
}

/** Back-compat wrapper used by payroll statutory pipeline. */
export function calculatePcb(input: {
  grossSalary: number;
  epfEmployee: number;
  maritalStatus: MaritalStatus | null | undefined;
  spouseWorking?: boolean | null;
  childCount: number;
  month?: number;
  accumulatedGrossY?: number;
  accumulatedEpfK?: number;
  accumulatedMtdX?: number;
  pcbMaritalDataVerified?: boolean;
}): number {
  return calculateMonthlyPcb({
    grossSalary: input.grossSalary,
    epfEmployee: input.epfEmployee,
    maritalStatus: input.maritalStatus,
    spouseWorking: input.spouseWorking,
    childCount: input.childCount,
    month: input.month ?? 1,
    accumulatedGrossY: input.accumulatedGrossY,
    accumulatedEpfK: input.accumulatedEpfK,
    accumulatedMtdX: input.accumulatedMtdX,
    pcbMaritalDataVerified: input.pcbMaritalDataVerified,
  }).pcb;
}
