import { getSadaoMonthlyCostSummary } from "@/app/actions/thai-cost";
import { SadaoMonthlySummaryView } from "@/components/thai-cost/SadaoMonthlySummaryView";
import { PageError } from "@/components/shared/PageError";
import { requirePageUser } from "@/lib/auth";
import { canAccessThaiCost } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function SadaoSummaryPage({ searchParams }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessThaiCost(user.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  try {
    const summary = await getSadaoMonthlyCostSummary(year, month);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            Sadao 月度汇总 Monthly Summary
          </h2>
          <p className="text-sm text-haidee-muted">
            月薪 + 日薪出勤 + 搬运提成 = Sadao 当月真实总成本
          </p>
        </div>
        <SadaoMonthlySummaryView summary={summary} />
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            Sadao 月度汇总 Monthly Summary
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
