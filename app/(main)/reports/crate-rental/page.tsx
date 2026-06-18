import { redirect } from "next/navigation";
import { getCrateRentalMonthlyReport } from "@/app/actions/crate-rental-monthly";
import { CrateRentalMonthlyView } from "@/components/reports/CrateRentalMonthlyView";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser } from "@/lib/auth";
import { canViewOperationsDashboard } from "@/lib/auth-roles";
import {
  parseReportMonth,
  parseReportYear,
} from "@/lib/reports/parse-report-params";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";

interface CrateRentalReportPageProps {
  searchParams: Promise<{
    year?: string;
    month?: string;
  }>;
}

export default async function CrateRentalReportPage({
  searchParams,
}: CrateRentalReportPageProps) {
  const user = await getCurrentUser();
  if (!user || !canViewOperationsDashboard(user.role as UserRole)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const year = parseReportYear(params.year);
  const month = parseReportMonth(params.month);

  try {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col gap-6">
        <div className="shrink-0">
          <h2 className="text-2xl font-bold text-haidee-text">
            租桶月结对账 Crate Rental Statement
          </h2>
          <p className="text-sm text-haidee-muted">
            按桶型汇总当月租桶数量与供应商结算金额（原币 + 折合 MYR），便于与租桶供应商月结单核对
          </p>
        </div>
        <div className="min-h-0 min-w-0 flex-1">
          <CrateRentalMonthlyView
            initialYear={year}
            initialMonth={month}
            onLoad={getCrateRentalMonthlyReport}
          />
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            租桶月结对账 Crate Rental Statement
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
