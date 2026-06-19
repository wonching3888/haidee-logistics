"use client";

import { Loader2 } from "lucide-react";

interface ReportQueryButtonProps {
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function ReportQueryButton({
  loading = false,
  disabled = false,
  onClick,
}: ReportQueryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-haidee-blue px-4 text-sm font-medium text-white hover:bg-haidee-blue/90 disabled:opacity-60"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? "查询中…" : "查询 Search"}
    </button>
  );
}
