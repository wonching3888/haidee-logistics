"use client";

import { REPORT_YEAR_OPTIONS } from "@/lib/reports/report-query-params";

interface YearMonthFieldsProps {
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  yearOptions?: number[];
  monthSuffix?: string;
}

export function YearMonthFields({
  year,
  month,
  onYearChange,
  onMonthChange,
  yearOptions = REPORT_YEAR_OPTIONS,
  monthSuffix = "月",
}: YearMonthFieldsProps) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-haidee-text">年份 Year</span>
        <select
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
          className="min-h-[44px] rounded-lg border border-haidee-border px-3 text-sm"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-haidee-text">月份 Month</span>
        <select
          value={month}
          onChange={(e) => onMonthChange(Number(e.target.value))}
          className="min-h-[44px] rounded-lg border border-haidee-border px-3 text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}
              {monthSuffix}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
