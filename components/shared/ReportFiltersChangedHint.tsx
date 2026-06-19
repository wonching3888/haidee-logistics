"use client";

import { FILTERS_CHANGED_HINT } from "@/lib/reports/report-query-params";

export function ReportFiltersChangedHint({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {FILTERS_CHANGED_HINT}
    </p>
  );
}
