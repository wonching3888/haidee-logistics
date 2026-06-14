/** PERKESO First Category contribution table (wage ceiling RM6,000). */
export const SOCSO_BRACKETS: {
  wageTo: number;
  employee: number;
  employer: number;
}[] = [
  { wageTo: 30, employee: 0.1, employer: 0.4 },
  { wageTo: 50, employee: 0.2, employer: 0.7 },
  { wageTo: 70, employee: 0.3, employer: 1.0 },
  { wageTo: 100, employee: 0.4, employer: 1.4 },
  { wageTo: 140, employee: 0.55, employer: 1.95 },
  { wageTo: 200, employee: 0.8, employer: 2.8 },
  { wageTo: 300, employee: 1.15, employer: 4.05 },
  { wageTo: 400, employee: 1.5, employer: 5.3 },
  { wageTo: 500, employee: 1.85, employer: 6.55 },
  { wageTo: 600, employee: 2.2, employer: 7.8 },
  { wageTo: 700, employee: 2.55, employer: 9.05 },
  { wageTo: 800, employee: 2.9, employer: 10.3 },
  { wageTo: 900, employee: 3.25, employer: 11.55 },
  { wageTo: 1000, employee: 3.6, employer: 12.8 },
  { wageTo: 1100, employee: 3.95, employer: 14.05 },
  { wageTo: 1200, employee: 4.3, employer: 15.3 },
  { wageTo: 1300, employee: 4.65, employer: 16.55 },
  { wageTo: 1400, employee: 5.0, employer: 17.8 },
  { wageTo: 1500, employee: 5.35, employer: 19.05 },
  { wageTo: 1600, employee: 5.7, employer: 20.3 },
  { wageTo: 1700, employee: 6.05, employer: 21.55 },
  { wageTo: 1800, employee: 6.4, employer: 22.8 },
  { wageTo: 1900, employee: 6.75, employer: 24.05 },
  { wageTo: 2000, employee: 7.1, employer: 25.3 },
  { wageTo: 2100, employee: 7.45, employer: 26.55 },
  { wageTo: 2200, employee: 7.8, employer: 27.8 },
  { wageTo: 2300, employee: 8.15, employer: 29.05 },
  { wageTo: 2400, employee: 8.5, employer: 30.3 },
  { wageTo: 2500, employee: 8.85, employer: 31.55 },
  { wageTo: 2600, employee: 9.2, employer: 32.8 },
  { wageTo: 2700, employee: 9.55, employer: 34.05 },
  { wageTo: 2800, employee: 9.9, employer: 35.3 },
  { wageTo: 2900, employee: 10.25, employer: 36.55 },
  { wageTo: 3000, employee: 10.6, employer: 37.8 },
  { wageTo: 3100, employee: 10.95, employer: 39.05 },
  { wageTo: 3200, employee: 11.3, employer: 40.3 },
  { wageTo: 3300, employee: 11.65, employer: 41.55 },
  { wageTo: 3400, employee: 12.0, employer: 42.8 },
  { wageTo: 3500, employee: 12.35, employer: 44.05 },
  { wageTo: 3600, employee: 12.7, employer: 45.3 },
  { wageTo: 3700, employee: 13.05, employer: 46.55 },
  { wageTo: 3800, employee: 13.4, employer: 47.8 },
  { wageTo: 3900, employee: 13.75, employer: 49.05 },
  { wageTo: 4000, employee: 14.1, employer: 50.3 },
  { wageTo: 4100, employee: 14.45, employer: 51.55 },
  { wageTo: 4200, employee: 14.8, employer: 52.8 },
  { wageTo: 4300, employee: 15.15, employer: 54.05 },
  { wageTo: 4400, employee: 15.5, employer: 55.3 },
  { wageTo: 4500, employee: 15.85, employer: 56.55 },
  { wageTo: 4600, employee: 16.2, employer: 57.8 },
  { wageTo: 4700, employee: 16.55, employer: 59.05 },
  { wageTo: 4800, employee: 16.9, employer: 60.3 },
  { wageTo: 4900, employee: 17.25, employer: 61.55 },
  { wageTo: 5000, employee: 17.6, employer: 62.8 },
  { wageTo: 5100, employee: 17.95, employer: 64.05 },
  { wageTo: 5200, employee: 18.3, employer: 65.3 },
  { wageTo: 5300, employee: 18.65, employer: 66.55 },
  { wageTo: 5400, employee: 19.0, employer: 67.8 },
  { wageTo: 5500, employee: 19.35, employer: 69.05 },
  { wageTo: 5600, employee: 19.7, employer: 70.3 },
  { wageTo: 5700, employee: 20.05, employer: 71.55 },
  { wageTo: 5800, employee: 20.4, employer: 72.8 },
  { wageTo: 5900, employee: 20.75, employer: 74.05 },
  { wageTo: 6000, employee: 21.1, employer: 75.3 },
];

export function lookupSocsoContributions(monthlyWage: number) {
  const wage = Math.min(Math.max(monthlyWage, 0), 6000);
  const bracket =
    SOCSO_BRACKETS.find((row) => wage <= row.wageTo) ??
    SOCSO_BRACKETS[SOCSO_BRACKETS.length - 1];
  return { employee: bracket.employee, employer: bracket.employer };
}
