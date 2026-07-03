/**
 * PERKESO Lindung 24 Jam (SKBBK) — Non-Employment Injury Scheme employee contribution.
 * Bracket schedule effective 1 Jun 2026 (Phase 1, 0.75%).
 *
 * Source: PERKESO Jadual Caruman Baharu Termasuk SKBBK
 * https://www.perkeso.gov.my/images/lindung/lindung-24-jam/JadualCarumanBaharuTermasukSKBBK.pdf
 * Cross-checked: https://payroll.my/payroll-software/socso-contribution-table (Category 1 & 2 SKBBK column)
 *
 * Anchors (PERKESO FAQ): wage ≤ RM30 → 0.20; wage ≥ RM6000 → 44.65 (not 45.00).
 */
export const LINDUNG_24_JAM_BRACKETS: { wageTo: number; employee: number }[] = [
  { wageTo: 30, employee: 0.2 },
  { wageTo: 50, employee: 0.3 },
  { wageTo: 70, employee: 0.5 },
  { wageTo: 100, employee: 0.65 },
  { wageTo: 140, employee: 0.9 },
  { wageTo: 200, employee: 1.25 },
  { wageTo: 300, employee: 1.85 },
  { wageTo: 400, employee: 2.65 },
  { wageTo: 500, employee: 3.35 },
  { wageTo: 600, employee: 4.15 },
  { wageTo: 700, employee: 4.85 },
  { wageTo: 800, employee: 5.65 },
  { wageTo: 900, employee: 6.35 },
  { wageTo: 1000, employee: 7.15 },
  { wageTo: 1100, employee: 7.85 },
  { wageTo: 1200, employee: 8.65 },
  { wageTo: 1300, employee: 9.35 },
  { wageTo: 1400, employee: 10.15 },
  { wageTo: 1500, employee: 10.85 },
  { wageTo: 1600, employee: 11.65 },
  { wageTo: 1700, employee: 12.35 },
  { wageTo: 1800, employee: 13.15 },
  { wageTo: 1900, employee: 13.85 },
  { wageTo: 2000, employee: 14.65 },
  { wageTo: 2100, employee: 15.35 },
  { wageTo: 2200, employee: 16.15 },
  { wageTo: 2300, employee: 16.85 },
  { wageTo: 2400, employee: 17.65 },
  { wageTo: 2500, employee: 18.35 },
  { wageTo: 2600, employee: 19.15 },
  { wageTo: 2700, employee: 19.85 },
  { wageTo: 2800, employee: 20.65 },
  { wageTo: 2900, employee: 21.35 },
  { wageTo: 3000, employee: 22.15 },
  { wageTo: 3100, employee: 22.85 },
  { wageTo: 3200, employee: 23.65 },
  { wageTo: 3300, employee: 24.35 },
  { wageTo: 3400, employee: 25.15 },
  { wageTo: 3500, employee: 25.85 },
  { wageTo: 3600, employee: 26.65 },
  { wageTo: 3700, employee: 27.35 },
  { wageTo: 3800, employee: 28.15 },
  { wageTo: 3900, employee: 28.85 },
  { wageTo: 4000, employee: 29.65 },
  { wageTo: 4100, employee: 30.35 },
  { wageTo: 4200, employee: 31.15 },
  { wageTo: 4300, employee: 31.85 },
  { wageTo: 4400, employee: 32.65 },
  { wageTo: 4500, employee: 33.35 },
  { wageTo: 4600, employee: 34.15 },
  { wageTo: 4700, employee: 34.85 },
  { wageTo: 4800, employee: 35.65 },
  { wageTo: 4900, employee: 36.35 },
  { wageTo: 5000, employee: 37.15 },
  { wageTo: 5100, employee: 37.85 },
  { wageTo: 5200, employee: 38.65 },
  { wageTo: 5300, employee: 39.35 },
  { wageTo: 5400, employee: 40.15 },
  { wageTo: 5500, employee: 40.85 },
  { wageTo: 5600, employee: 41.65 },
  { wageTo: 5700, employee: 42.35 },
  { wageTo: 5800, employee: 43.15 },
  { wageTo: 5900, employee: 43.85 },
  { wageTo: 6000, employee: 44.65 },
];

export function lookupLindung24Jam(monthlyWage: number) {
  const wage = Math.min(Math.max(monthlyWage, 0), 6000);
  const bracket =
    LINDUNG_24_JAM_BRACKETS.find((row) => wage <= row.wageTo) ??
    LINDUNG_24_JAM_BRACKETS[LINDUNG_24_JAM_BRACKETS.length - 1];
  return bracket.employee;
}
