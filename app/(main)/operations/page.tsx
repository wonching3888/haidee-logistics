import { Suspense } from "react";
import { redirect } from "next/navigation";
import { OperationsDashboardView } from "@/components/operations/OperationsDashboardView";
import { getCurrentUser } from "@/lib/auth";
import { canViewOperationsDashboard } from "@/lib/auth-roles";
import {
  parseReportMonth,
  parseReportYear,
} from "@/lib/reports/parse-report-params";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";

interface OperationsPageProps {
  searchParams: Promise<{ year?: string; month?: string; q?: string }>;
}

export default async function OperationsPage({
  searchParams,
}: OperationsPageProps) {
  const user = await getCurrentUser();
  if (!user || !canViewOperationsDashboard(user.role as UserRole)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const year = parseReportYear(params.year);
  const month = parseReportMonth(params.month);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          运营报表 Operations
        </h2>
        <p className="text-sm text-haidee-muted">
          月度收入与成本概览（统一换算 MYR）· Admin / Accounting / Owner
        </p>
      </div>

      <Suspense
        fallback={
          <div className="h-32 animate-pulse rounded-lg bg-haidee-border/30" />
        }
      >
        <OperationsDashboardView initialYear={year} initialMonth={month} />
      </Suspense>
    </div>
  );
}
