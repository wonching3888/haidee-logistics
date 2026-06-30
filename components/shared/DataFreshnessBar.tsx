"use client";

import { Loader2 } from "lucide-react";
import { useT } from "@/components/shared/locale-context";
import { Button } from "@/components/ui/button";
import {
  useDataFreshness,
  type UseDataFreshnessOptions,
} from "@/lib/hooks/use-data-freshness";
import { formatDisplayTime } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

export type DataFreshnessBarProps = UseDataFreshnessOptions & {
  /** When enabled is false, render nothing (e.g. monthly invoice before query). */
  hideWhenDisabled?: boolean;
  className?: string;
};

function formatTimeLabel(date: Date): string {
  return formatDisplayTime(date);
}

export function DataFreshnessBar({
  hideWhenDisabled = false,
  enabled = true,
  className,
  ...options
}: DataFreshnessBarProps) {
  const { t } = useT();
  const { lastLoadedAt, hasNewData, isRefreshing, refresh } = useDataFreshness({
    ...options,
    enabled,
  });

  if (hideWhenDisabled && !enabled) {
    return null;
  }

  const timeLabel = lastLoadedAt ? formatTimeLabel(lastLoadedAt) : "—";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-haidee-border/80 bg-haidee-surface/50 px-3 py-2 text-xs text-haidee-muted",
        className
      )}
      aria-live="polite"
    >
      <span>{t("dataFreshness.updatedAt", { time: timeLabel })}</span>
      {hasNewData ? (
        <>
          <span aria-hidden="true" className="text-haidee-muted/60">
            ·
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-haidee-red">
            <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-haidee-red" />
            {t("dataFreshness.newData")}
          </span>
        </>
      ) : null}
      <span aria-hidden="true" className="text-haidee-muted/60">
        ·
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-haidee-blue hover:text-haidee-blue"
        disabled={isRefreshing || !enabled}
        onClick={() => void refresh()}
      >
        {isRefreshing ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : null}
        {t("dataFreshness.refresh")}
      </Button>
    </div>
  );
}
