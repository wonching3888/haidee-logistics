import { listThaiMonthlyWorkers } from "@/app/actions/thai-cost";
import { MonthlyWorkersView } from "@/components/thai-cost/MonthlyWorkersView";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser, requirePageUser } from "@/lib/auth";
import { canAccessThaiCost, canWriteThaiCost } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

export default async function ThaiCostWorkersPage() {
  const user = await requirePageUser();
  if (!canAccessThaiCost(user.role)) {
    redirect("/dashboard");
  }

  try {
    const [workers, current] = await Promise.all([
      listThaiMonthlyWorkers({ includeInactive: true }),
      getCurrentUser(),
    ]);
    const canWrite = current ? canWriteThaiCost(current.role) : false;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            月薪工人 Monthly Workers
          </h2>
          <p className="text-sm text-haidee-muted">
            泰国边月薪工人档案 · 驻点 · 月薪 (THB)
          </p>
        </div>
        <MonthlyWorkersView workers={workers} canWrite={canWrite} />
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            月薪工人 Monthly Workers
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
