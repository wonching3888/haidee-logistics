import { getThaiCostDailyOverview } from "@/app/actions/thai-cost";
import { DailyOverviewView } from "@/components/thai-cost/DailyOverviewView";
import { ThaiCostPageHeader } from "@/components/thai-cost/ThaiCostPageHeader";
import { PageError } from "@/components/shared/PageError";
import { requirePageUser } from "@/lib/auth";
import { canAccessThaiCost } from "@/lib/auth-roles";
import { toDateInputValue } from "@/lib/date-utils";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function DailyOverviewPage({ searchParams }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessThaiCost(user.role)) redirect("/dashboard");

  const params = await searchParams;
  const date = params.date ?? toDateInputValue(new Date());

  try {
    const overview = await getThaiCostDailyOverview(date);

    return (
      <div className="space-y-6">
        <ThaiCostPageHeader
          titleKey="thaiCost.dailyOverview.pageTitle"
          subtitleKey="thaiCost.dailyOverview.pageSubtitle"
        />
        <DailyOverviewView overview={overview} />
      </div>
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
