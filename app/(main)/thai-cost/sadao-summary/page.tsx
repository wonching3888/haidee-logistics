import { getSadaoMonthlyCostSummary } from "@/app/actions/thai-cost";
import { SadaoMonthlySummaryView } from "@/components/thai-cost/SadaoMonthlySummaryView";
import { ThaiCostSummaryShell } from "@/components/thai-cost/ThaiCostEntryShell";
import { PageError } from "@/components/shared/PageError";
import { requirePageUser } from "@/lib/auth";
import { canAccessThaiCostMonthlySummary } from "@/lib/auth-roles";
import { getDefaultRoute } from "@/lib/routes";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function SadaoSummaryPage({ searchParams }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessThaiCostMonthlySummary(user.role)) {
    redirect(getDefaultRoute(user.role));
  }

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  try {
    const summary = await getSadaoMonthlyCostSummary(year, month);

    return (
      <ThaiCostSummaryShell
        activeTab="sadao"
        titleKey="thaiCost.sadaoSummary.pageTitle"
        subtitleKey="thaiCost.sadaoSummary.pageSubtitle"
      >
        <SadaoMonthlySummaryView summary={summary} />
      </ThaiCostSummaryShell>
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
