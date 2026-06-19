"use client";

import type { ReactNode } from "react";
import { ReportQueryButton } from "@/components/shared/ReportQueryButton";

interface ReportFilterBarProps {
  children: ReactNode;
  onSearch: () => void;
  loading?: boolean;
  actions?: ReactNode;
}

export function ReportFilterBar({
  children,
  onSearch,
  loading = false,
  actions,
}: ReportFilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      {children}
      <ReportQueryButton loading={loading} onClick={onSearch} />
      {actions}
    </div>
  );
}
