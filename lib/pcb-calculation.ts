/**
 * LHDN MTD (PCB) computerized calculation — formula engine (NOT production-wired).
 *
 * Intentionally not called from lib/payroll-statutory.ts payslip/JV paths until
 * accounting signs off and YTD opening balances are imported.
 *
 * Remaining out of scope:
 * - April Additional Remuneration (bonus) formula (EXHIBIT 5 Steps 2–5)
 * - Y/K/X opening-balance import from payroll history (engine accepts params; no DB yet)
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

/** Truncate toward zero to sen (omit subsequent figures). e.g. 308.6363… → 308.63 */
export function truncateToSen(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value >= 0
    ? Math.trunc(value * 100) / 100
    : -Math.trunc(-value * 100) / 100;
}

/** Half-up to sen (for display / YTD roll-forward only). */
export function roundToSen(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Round UP to the nearest 5 sen (LHDN MTD final step).
 * Examples: 287.02 → 287.05, 287.06 → 287.10, 287.00 → 287.00, 108.20042 → 108.20
 */
export function roundUpToNearest5Sen(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const cents = Math.round(value * 100);
  return (Math.ceil(cents / 5) * 5) / 100;
}

export interface PcbProfile {
  category: PcbEmployeeCategory;
  qualifyingChildren: number;
  needsReview: boolean;
  reviewReasons: string[];
}

/**
 * Year-to-date accumulators for the PCB formula (values BEFORE the current month).
 * Defaults are all 0 (treat as first payroll month of the year).
 * Opening-balance import will populate these for mid-year go-live.
 */
export interface PcbYearToDate {
  /** ∑Y — accumulated gross remuneration before current month. */
  accumulatedGrossY: number;
  /** ∑K — accumulated EPF employee before current month. */
  accumulatedEpfK: number;
  /** X — accumulated MTD (PCB) paid before current month. */
  accumulatedMtdX: number;
  /** ∑Z — accumulated zakat before current month. */
  accumulatedZakatZ: number;
}

export function emptyPcbYearToDate(): PcbYearToDate {
  return {
    accumulatedGrossY: 0,
    accumulatedEpfK: 0,
    accumulatedMtdX: 0,
    accumulatedZakatZ: 0,
  };
}

/** Roll YTD forward after a month is finalized (for multi-month exhibit / future import). */
export function advancePcbYearToDate(
  prior: PcbYearToDate,
  month: {
    grossSalary: number;
    epfEmployee: number;
    pcb: number;
    zakat?: number;
  }
): PcbYearToDate {
  return {
    accumulatedGrossY: roundToSen(prior.accumulatedGrossY + month.grossSalary),
    accumulatedEpfK: roundToSen(prior.accumulatedEpfK + month.epfEmployee),
    accumulatedMtdX: roundToSen(prior.accumulatedMtdX + month.pcb),
    accumulatedZakatZ: roundToSen(
      prior.accumulatedZakatZ + (month.zakat ?? 0)
    ),
  };
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
  /** ∑Y — accumulated gross before current month (default 0). */
  accumulatedGrossY?: number;
  /** ∑K — accumulated EPF before current month (default 0). */
  accumulatedEpfK?: number;
  /**
   * X — accumulated MTD paid before current month (default 0).
   * Required for months after January; opening-balance import will supply this.
   */
  accumulatedMtdX?: number;
  /** ∑Z — accumulated zakat before current month (default 0). */
  accumulatedZakatZ?: number;
  /**
   * LP — TP1 deductions for the year (∑LP + LP1), default 0.
   * Drivers typically have no TP1; field is reserved for future use.
   * Alias: `lpDeductions`.
   */
  lp?: number;
  /** @deprecated Prefer `lp`. Same as LP (TP1 deductions). */
  lpDeductions?: number;
  /** Additional remuneration net (Yt−Kt) for current month (default 0). Bonus formula not implemented. */
  additionalRemunerationNet?: number;
  /** Zakat for current month (default 0), subtracted after MTD. */
  currentMonthZakat?: number;
  /** When false, treat incomplete marital data as single (conservative). */
  pcbMaritalDataVerified?: boolean;
}

export interface MonthlyPcbResult {
  /** Final MTD after 5-sen round-up and current-month zakat (0 if below minimum). */
  pcb: number;
  /** Annual chargeable income P (to sen). */
  annualChargeableP: number;
  annualTax: number;
  /** MTD before current-month zakat, after 5-sen round-up. */
  mtdBeforeZakat: number;
  /** K2 after truncate-to-sen (used in P). */
  k2: number;
  /** LP (TP1) applied in P. */
  lp: number;
  /** X (accumulated MTD) applied in MTD formula. */
  accumulatedMtdX: number;
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

/**
 * K2 = min(K1, truncateToSen([4000 − (K + K1 + Kt)] / n))
 * Truncation is mandatory before any further use in P.
 */
export function computeK2(input: {
  kAccumulated: number;
  k1: number;
  kt?: number;
  n: number;
}): number {
  const kt = input.kt ?? 0;
  const remainingCap = Math.max(
    0,
    PCB_EPF_ANNUAL_CAP - input.kAccumulated - input.k1 - kt
  );
  const spread = input.n > 0 ? remainingCap / input.n : 0;
  const spreadTruncated = truncateToSen(spread);
  return Math.min(input.k1, spreadTruncated);
}

function resolveLp(input: MonthlyPcbInput): number {
  const raw = input.lp ?? input.lpDeductions ?? 0;
  return Math.max(0, raw);
}

function annualTaxFromP(p: number, category: PcbEmployeeCategory): number {
  if (p <= 5_000) return 0;

  for (const bracket of PCB_TAX_BRACKETS_2026) {
    if (p <= bracket.maxP) {
      const b =
        category === 2 ? bracket.bCat2 : bracket.bCat1And3;
      const tax = ((p - bracket.m) * bracket.r) / 100 + b;
      return Math.max(0, roundToSen(tax));
    }
  }
  return 0;
}

/**
 * LHDN normal remuneration MTD (PCB) — computerized calculation method 2026.
 * MTD = [(P – M) × R + B – (Z + X)] / (n + 1), then round UP to nearest 5 sen.
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
  const lp = resolveLp(input);
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
  const annualChargeableP = roundToSen(projected - (d + s + qc + lp));
  const annualTax = annualTaxFromP(annualChargeableP, profile.category);

  const bracket = PCB_TAX_BRACKETS_2026.find((b) => annualChargeableP <= b.maxP);
  const m = bracket?.m ?? 0;
  const r = bracket?.r ?? 0;
  const bVal =
    profile.category === 2 ? bracket?.bCat2 ?? 0 : bracket?.bCat1And3 ?? 0;

  const mtdNumerator =
    ((annualChargeableP - m) * r) / 100 + bVal - (z + x);
  const mtdRaw = mtdNumerator / (n + 1);
  const mtdBeforeZakat = roundUpToNearest5Sen(Math.max(0, mtdRaw));

  let pcb = 0;
  if (mtdBeforeZakat >= PCB_MINIMUM_DEDUCTION) {
    // 5-sen rule applies to MTD; current-month zakat is subtracted after.
    const netMtd = roundToSen(
      Math.max(0, mtdBeforeZakat - (input.currentMonthZakat ?? 0))
    );
    pcb = netMtd >= PCB_MINIMUM_DEDUCTION ? netMtd : 0;
  }

  return {
    pcb,
    annualChargeableP,
    annualTax,
    mtdBeforeZakat,
    k2,
    lp,
    accumulatedMtdX: x,
    profile,
  };
}

/** Estimate YTD gross/EPF for months before current (uniform salary assumption). */
export function estimatePayrollYtdForPcb(input: {
  grossSalary: number;
  epfEmployee: number;
  month: number;
}): Pick<PcbYearToDate, "accumulatedGrossY" | "accumulatedEpfK"> {
  const prior = Math.max(0, Math.min(11, Math.round(input.month) - 1));
  return {
    accumulatedGrossY: roundToSen(prior * input.grossSalary),
    accumulatedEpfK: roundToSen(prior * input.epfEmployee),
  };
}

/** Back-compat wrapper used by payroll statutory pipeline (when re-enabled). */
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
  lp?: number;
  lpDeductions?: number;
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
    lp: input.lp,
    lpDeductions: input.lpDeductions,
    pcbMaritalDataVerified: input.pcbMaritalDataVerified,
  }).pcb;
}
