import { redirect } from "next/navigation";
import { PnlReportView } from "@/components/reports/PnlReportView";
import { getCurrentUser } from "@/lib/auth";
import { canViewOperationsDashboard } from "@/lib/auth-roles";
import {
  parseReportMonth,
  parseReportYear,
} from "@/lib/reports/parse-report-params";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";

interface PnlReportPageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function PnlReportPage({ searchParams }: PnlReportPageProps) {
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
          损益分析 P&L Analysis
        </h2>
        <p className="text-sm text-haidee-muted">
          趟次 / 时间 / 顾客三维度毛利分析 · 收入按实时运费费率计算 · 成本含直接成本与按桶数分摊成本
        </p>
      </div>

      <PnlReportView initialYear={year} initialMonth={month} />
    </div>
  );
}
