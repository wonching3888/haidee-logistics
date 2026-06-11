import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/app/actions/dashboard";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getDashboardData()]);

  return (
    <div className="space-y-2">
      <p className="text-sm text-haidee-muted">
        欢迎回来，{user?.name ?? user?.email}
      </p>
      <DashboardView
        todayStr={data.todayStr}
        dailySummary={data.dailySummary}
        stats={data.stats}
        marketTotals={data.marketTotals}
        unassignedWarning={data.unassignedWarning}
        recentOrders={data.recentOrders}
      />
    </div>
  );
}
