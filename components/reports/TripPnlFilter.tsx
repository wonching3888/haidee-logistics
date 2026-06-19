"use client";

import { PNL_ROUTE_FILTERS } from "@/lib/pnl-report-types";
import { REPORT_YEAR_OPTIONS } from "@/lib/reports/report-query-params";
import { ReportQueryButton } from "@/components/shared/ReportQueryButton";

export interface TripPnlFilterValues {
  year: number;
  month: number;
  route: string;
  driver: string;
  date: string;
}

interface TripPnlFilterProps {
  values: TripPnlFilterValues;
  drivers?: string[];
  loading?: boolean;
  onChange: (patch: Partial<TripPnlFilterValues>) => void;
  onSearch: () => void;
}

export default function TripPnlFilter({
  values,
  drivers = [],
  loading = false,
  onChange,
  onSearch,
}: TripPnlFilterProps) {
  const { year, month, route, driver, date } = values;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-haidee-text">年份 Year</span>
          <select
            value={year}
            onChange={(e) => onChange({ year: Number(e.target.value) })}
            className="min-h-[44px] rounded-lg border border-haidee-border px-3 text-sm"
          >
            {REPORT_YEAR_OPTIONS.map((y) => (
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
            onChange={(e) => onChange({ month: Number(e.target.value) })}
            className="min-h-[44px] rounded-lg border border-haidee-border px-3 text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m} 月
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-haidee-text">路线 Route</span>
          <select
            value={route}
            onChange={(e) => onChange({ route: e.target.value })}
            className="min-h-[44px] rounded-lg border border-haidee-border px-3 text-sm"
          >
            {PNL_ROUTE_FILTERS.map((r) => (
              <option key={r} value={r}>
                {r === "ALL" ? "全部 All" : r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-haidee-text">司机 Driver</span>
          <select
            value={driver}
            onChange={(e) => onChange({ driver: e.target.value })}
            className="min-h-[44px] rounded-lg border border-haidee-border px-3 text-sm"
          >
            <option value="ALL">全部 All</option>
            {drivers.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-haidee-text">日期 Date（可选）</span>
          <input
            type="date"
            value={date}
            onChange={(e) => onChange({ date: e.target.value })}
            className="min-h-[44px] rounded-lg border border-haidee-border px-3 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => onChange({ date: "" })}
          className="min-h-[44px] rounded-lg border border-haidee-blue px-3 text-sm text-haidee-blue hover:bg-haidee-blue/10"
        >
          清空日期
        </button>
        <ReportQueryButton loading={loading} onClick={onSearch} />
      </div>
    </div>
  );
}
