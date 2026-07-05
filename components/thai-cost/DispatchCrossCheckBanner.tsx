"use client";

import { AlertTriangle } from "lucide-react";
import type { DispatchCrossCheckResult } from "@/lib/thai-cost/dispatch-cross-check";

export function DispatchCrossCheckBanner({
  result,
}: {
  result: DispatchCrossCheckResult | null;
}) {
  if (!result?.exceedsThreshold || !result.message) return null;

  return (
    <div
      className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      role="status"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <p>{result.message}</p>
    </div>
  );
}
