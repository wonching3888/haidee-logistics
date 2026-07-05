import { Suspense } from "react";
import {
  ThaiCostSummaryTabNav,
  ThaiCostTabNav,
} from "@/components/thai-cost/ThaiCostTabNav";

export function ThaiCostEntryShell({
  activeTab,
  title,
  subtitle,
  children,
}: {
  activeTab:
    | "attendance"
    | "sadao"
    | "songkhla"
    | "pattani"
    | "driver-trips"
    | "rented";
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        {subtitle && (
          <p className="text-sm text-haidee-muted">{subtitle}</p>
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
  title,
  subtitle,
  children,
}: {
  activeTab: "sadao" | "songkhla" | "pattani";
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        {subtitle && (
          <p className="text-sm text-haidee-muted">{subtitle}</p>
        )}
      </div>
      <Suspense fallback={null}>
        <ThaiCostSummaryTabNav activeTab={activeTab} />
      </Suspense>
      {children}
    </div>
  );
}
