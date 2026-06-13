import type { PeriodReportMode } from "@/lib/reports/period-report-shared";

export function parseReportMode(raw?: string): PeriodReportMode {
  return raw === "yearly" ? "yearly" : "monthly";
}

export function parseReportYear(raw?: string): number {
  const year = Number(raw);
  if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
    return year;
  }
  return new Date().getFullYear();
}

export function parseReportMonth(raw?: string): number {
  const month = Number(raw);
  if (Number.isInteger(month) && month >= 1 && month <= 12) {
    return month;
  }
  return new Date().getMonth() + 1;
}
