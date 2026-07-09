"use client";

import { Suspense } from "react";
import { useT } from "@/components/shared/locale-context";
import type { MessageKey } from "@/lib/i18n/messages";
import {
  ThaiCostSummaryTabNav,
  ThaiCostTabNav,
} from "@/components/thai-cost/ThaiCostTabNav";

type EntryTab =
  | "attendance"
  | "handling"
  | "driver-trips"
  | "rented";

export function ThaiCostEntryShell({
  activeTab,
  titleKey,
  subtitleKey,
  children,
}: {
  activeTab: EntryTab;
  titleKey: MessageKey;
  subtitleKey?: MessageKey;
  children: React.ReactNode;
}) {
  const { tLocal } = useT();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{tLocal(titleKey)}</h2>
        {subtitleKey && (
          <p className="text-sm text-haidee-muted">{tLocal(subtitleKey)}</p>
        )}
      </div>
      <Suspense fallback={null}>
        <ThaiCostTabNav activeTab={activeTab} />
      </Suspense>
      {children}
    </div>
  );
}

export function ThaiCostSummaryShell({
  activeTab,
  titleKey,
  subtitleKey,
  children,
}: {
  activeTab: "sadao" | "songkhla" | "pattani";
  titleKey: MessageKey;
  subtitleKey?: MessageKey;
  children: React.ReactNode;
}) {
  const { tLocal } = useT();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{tLocal(titleKey)}</h2>
        {subtitleKey && (
          <p className="text-sm text-haidee-muted">{tLocal(subtitleKey)}</p>
        )}
      </div>
      <Suspense fallback={null}>
        <ThaiCostSummaryTabNav activeTab={activeTab} />
      </Suspense>
      {children}
    </div>
  );
}
