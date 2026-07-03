/**
 * PERKESO First Category (Employment Injury + Invalidity / Keilatan).
 * Effective 1 Jun 2026 — Majikan1 (employer) + Pekerja1-Keilatan (employee).
 *
 * Source: PERKESO Jadual Caruman Baharu Termasuk SKBBK
 * https://www.perkeso.gov.my/images/lindung/lindung-24-jam/JadualCarumanBaharuTermasukSKBBK.pdf
 * Cross-check: https://payroll.my/payroll-software/socso-contribution-table (Category 1, Invalidity columns)
 */
export const SOCSO_BRACKETS: {
  wageTo: number;
  employee: number;
  employer: number;
}[] = [
  { wageTo: 30, employee: 0.1, employer: 0.4 },
  { wageTo: 50, employee: 0.2, employer: 0.7 },
  { wageTo: 70, employee: 0.3, employer: 1.1 },
  { wageTo: 100, employee: 0.4, employer: 1.5 },
  { wageTo: 140, employee: 0.6, employer: 2.1 },
  { wageTo: 200, employee: 0.85, employer: 2.95 },
  { wageTo: 300, employee: 1.25, employer: 4.35 },
  { wageTo: 400, employee: 1.75, employer: 6.15 },
  { wageTo: 500, employee: 2.25, employer: 7.85 },
  { wageTo: 600, employee: 2.75, employer: 9.65 },
  { wageTo: 700, employee: 3.25, employer: 11.35 },
  { wageTo: 800, employee: 3.75, employer: 13.15 },
  { wageTo: 900, employee: 4.25, employer: 14.85 },
  { wageTo: 1000, employee: 4.75, employer: 16.65 },
  { wageTo: 1100, employee: 5.25, employer: 18.35 },
  { wageTo: 1200, employee: 5.75, employer: 20.15 },
  { wageTo: 1300, employee: 6.25, employer: 21.85 },
  { wageTo: 1400, employee: 6.75, employer: 23.65 },
  { wageTo: 1500, employee: 7.25, employer: 25.35 },
  { wageTo: 1600, employee: 7.75, employer: 27.15 },
  { wageTo: 1700, employee: 8.25, employer: 28.85 },
  { wageTo: 1800, employee: 8.75, employer: 30.65 },
  { wageTo: 1900, employee: 9.25, employer: 32.35 },
  { wageTo: 2000, employee: 9.75, employer: 34.15 },
  { wageTo: 2100, employee: 10.25, employer: 35.85 },
  { wageTo: 2200, employee: 10.75, employer: 37.65 },
  { wageTo: 2300, employee: 11.25, employer: 39.35 },
  { wageTo: 2400, employee: 11.75, employer: 41.15 },
  { wageTo: 2500, employee: 12.25, employer: 42.85 },
  { wageTo: 2600, employee: 12.75, employer: 44.65 },
  { wageTo: 2700, employee: 13.25, employer: 46.35 },
  { wageTo: 2800, employee: 13.75, employer: 48.15 },
  { wageTo: 2900, employee: 14.25, employer: 49.85 },
  { wageTo: 3000, employee: 14.75, employer: 51.65 },
  { wageTo: 3100, employee: 15.25, employer: 53.35 },
  { wageTo: 3200, employee: 15.75, employer: 55.15 },
  { wageTo: 3300, employee: 16.25, employer: 56.85 },
  { wageTo: 3400, employee: 16.75, employer: 58.65 },
  { wageTo: 3500, employee: 17.25, employer: 60.35 },
  { wageTo: 3600, employee: 17.75, employer: 62.15 },
  { wageTo: 3700, employee: 18.25, employer: 63.85 },
  { wageTo: 3800, employee: 18.75, employer: 65.65 },
  { wageTo: 3900, employee: 19.25, employer: 67.35 },
  { wageTo: 4000, employee: 19.75, employer: 69.15 },
  { wageTo: 4100, employee: 20.25, employer: 70.85 },
  { wageTo: 4200, employee: 20.75, employer: 72.65 },
  { wageTo: 4300, employee: 21.25, employer: 74.35 },
  { wageTo: 4400, employee: 21.75, employer: 76.15 },
  { wageTo: 4500, employee: 22.25, employer: 77.85 },
  { wageTo: 4600, employee: 22.75, employer: 79.65 },
  { wageTo: 4700, employee: 23.25, employer: 81.35 },
  { wageTo: 4800, employee: 23.75, employer: 83.15 },
  { wageTo: 4900, employee: 24.25, employer: 84.85 },
  { wageTo: 5000, employee: 24.75, employer: 86.65 },
  { wageTo: 5100, employee: 25.25, employer: 88.35 },
  { wageTo: 5200, employee: 25.75, employer: 90.15 },
  { wageTo: 5300, employee: 26.25, employer: 91.85 },
  { wageTo: 5400, employee: 26.75, employer: 93.65 },
  { wageTo: 5500, employee: 27.25, employer: 95.35 },
  { wageTo: 5600, employee: 27.75, employer: 97.15 },
  { wageTo: 5700, employee: 28.25, employer: 98.85 },
  { wageTo: 5800, employee: 28.75, employer: 100.65 },
  { wageTo: 5900, employee: 29.25, employer: 102.35 },
  { wageTo: 6000, employee: 29.75, employer: 104.15 },
];

export function lookupSocsoContributions(monthlyWage: number) {
  const wage = Math.min(Math.max(monthlyWage, 0), 6000);
  const bracket =
    SOCSO_BRACKETS.find((row) => wage <= row.wageTo) ??
    SOCSO_BRACKETS[SOCSO_BRACKETS.length - 1];
  return { employee: bracket.employee, employer: bracket.employer };
}
