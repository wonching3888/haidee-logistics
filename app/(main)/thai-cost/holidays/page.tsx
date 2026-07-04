import { listThaiPublicHolidays } from "@/app/actions/thai-cost";
import { HolidaysView } from "@/components/thai-cost/HolidaysView";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser, requirePageUser } from "@/lib/auth";
import { canAccessThaiCost, canWriteThaiCost } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function ThaiCostHolidaysPage({ searchParams }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessThaiCost(user.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const year = Number(params.year) || new Date().getFullYear();

  try {
    const [holidays, current] = await Promise.all([
      listThaiPublicHolidays({ year }),
      getCurrentUser(),
    ]);
    const canWrite = current ? canWriteThaiCost(current.role) : false;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            假期设置 Public Holidays
          </h2>
          <p className="text-sm text-haidee-muted">
            泰国公众假期日历 · 假日搬运费率自动套用
          </p>
        </div>
        <HolidaysView year={year} holidays={holidays} canWrite={canWrite} />
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            假期设置 Public Holidays
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
