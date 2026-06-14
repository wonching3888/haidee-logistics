import { redirect } from "next/navigation";
import { OperationsDashboardView } from "@/components/operations/OperationsDashboardView";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser } from "@/lib/auth";
import { canViewOperationsDashboard } from "@/lib/auth-roles";
import type { UserRole } from "@/types";

interface OperationsPageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function OperationsPage({ searchParams }: OperationsPageProps) {
  const user = await getCurrentUser();
  if (!user || !canViewOperationsDashboard(user.role as UserRole)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  try {
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

        <OperationsDashboardView initialYear={year} initialMonth={month} />
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            运营报表 Operations
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
