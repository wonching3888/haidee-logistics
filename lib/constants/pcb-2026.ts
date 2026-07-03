/**
 * LHDN MTD (PCB) computerized calculation — Year of Assessment 2026.
 * Source: spesifikasi-kaedah-pengiraan-berkomputer-pcb-2026.pdf (updated 01 Jan 2026)
 * Budget 2026: MTD formula unchanged; TP1/TP3 deduction items amended only.
 */

/** Individual relief (D) — automatic per employee. */
export const PCB_INDIVIDUAL_RELIEF_ANNUAL = 9_000;

/** Spouse relief (S) when spouse not working — Category 2. */
export const PCB_SPOUSE_RELIEF_ANNUAL = 4_000;

/** Per qualifying child (QC = 2,000 × C). */
export const PCB_CHILD_RELIEF_PER_CHILD = 2_000;

/** EPF + approved scheme annual cap for MTD formula (K*). */
export const PCB_EPF_ANNUAL_CAP = 4_000;

/** MTD not required when amount before zakat is below this (RM). */
export const PCB_MINIMUM_DEDUCTION = 10;

/**
 * Jadual PCB monthly net thresholds (after EPF) — table method reference only.
 * Computerized method uses annual P; these are NOT hard cut-offs in the formula.
 */
export const PCB_JADUAL_MONTHLY_NET_THRESHOLD_SINGLE = 2_851;
export const PCB_JADUAL_MONTHLY_NET_THRESHOLD_MARRIED = 3_851;

export type PcbEmployeeCategory = 1 | 2 | 3;

/** Table 1: first chargeable income M, rate R (%), rebate-adjusted base B by category. */
export interface PcbTaxBracket {
  maxP: number;
  m: number;
  r: number;
  bCat1And3: number;
  bCat2: number;
}

export const PCB_TAX_BRACKETS_2026: PcbTaxBracket[] = [
  { maxP: 5_000, m: 0, r: 0, bCat1And3: 0, bCat2: 0 },
  { maxP: 20_000, m: 5_000, r: 1, bCat1And3: -400, bCat2: -800 },
  { maxP: 35_000, m: 20_000, r: 3, bCat1And3: -250, bCat2: -650 },
  { maxP: 50_000, m: 35_000, r: 6, bCat1And3: 600, bCat2: 600 },
  { maxP: 70_000, m: 50_000, r: 11, bCat1And3: 1_500, bCat2: 1_500 },
  { maxP: 100_000, m: 70_000, r: 19, bCat1And3: 3_700, bCat2: 3_700 },
  { maxP: 400_000, m: 100_000, r: 25, bCat1And3: 9_400, bCat2: 9_400 },
  { maxP: 600_000, m: 400_000, r: 26, bCat1And3: 84_400, bCat2: 84_400 },
  { maxP: 2_000_000, m: 600_000, r: 28, bCat1And3: 136_400, bCat2: 136_400 },
  { maxP: Number.POSITIVE_INFINITY, m: 2_000_000, r: 30, bCat1And3: 528_400, bCat2: 528_400 },
];
