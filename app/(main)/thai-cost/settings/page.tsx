import {
  getThaiCostRateSettings,
  getThaiCostRatesForMonth,
  getThaiRouteMasters,
} from "@/app/actions/thai-cost-phase2";
import { ThaiCostSettingsView } from "@/components/thai-cost/ThaiCostSettingsView";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser, requirePageUser } from "@/lib/auth";
import { canAccessThaiCost, canWriteThaiCost } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function ThaiCostSettingsPage({ searchParams }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessThaiCost(user.role)) redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  try {
    const [rates, monthRates, thaiRoutes, current] = await Promise.all([
      getThaiCostRateSettings(),
      getThaiCostRatesForMonth({ year, month }),
      getThaiRouteMasters(),
      getCurrentUser(),
    ]);
    const canWrite = current ? canWriteThaiCost(current.role) : false;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            泰国成本设置 Thai Cost Settings
          </h2>
          <p className="text-sm text-haidee-muted">
            搬运费率 · 司机趟次提成 · 月度费率/内部成本快照锁定
          </p>
        </div>
        <ThaiCostSettingsView
          initialRates={rates}
          thaiRoutes={thaiRoutes}
          canWrite={canWrite}
          year={year}
          month={month}
          monthRatesLocked={monthRates.locked}
        />
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">泰国成本设置</h2>
        <PageError error={error} />
      </div>
    );
  }
}
