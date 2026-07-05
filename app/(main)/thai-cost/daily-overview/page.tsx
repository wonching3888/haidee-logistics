import { getThaiCostDailyOverview } from "@/app/actions/thai-cost";
import { DailyOverviewView } from "@/components/thai-cost/DailyOverviewView";
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
        <div>
          <h2 className="text-2xl font-bold">每日总览 Daily Overview</h2>
          <p className="text-sm text-haidee-muted">
            Sadao / 宋卡 / 北大年分区独立展示，不含跨类别总盈亏。
          </p>
        </div>
        <DailyOverviewView overview={overview} />
      </div>
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
