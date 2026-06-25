import { redirect } from "next/navigation";
import { DriverExpensesClient } from "@/components/driver-expenses/DriverExpensesClient";
import { getCurrentUser } from "@/lib/auth";
import { canAccessDriverExpenses } from "@/lib/auth-roles";
import { resolveDateParam } from "@/lib/date-utils";
import { getDefaultRoute } from "@/lib/routes";

export const dynamic = "force-dynamic";

interface DriverExpensesPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function DriverExpensesPage({
  searchParams,
}: DriverExpensesPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!canAccessDriverExpenses(user.role)) {
    redirect(getDefaultRoute(user.role));
  }

  const params = await searchParams;
  const date = resolveDateParam(params.date);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          司机费用 Driver Expenses
        </h2>
        <p className="text-sm text-haidee-muted">
          下货费 · 上桶费 · 司机报销单 Upah Turun / Naik Tong / Voucher
        </p>
      </div>
      <DriverExpensesClient initialDate={date} userRole={user.role} />
    </div>
  );
}
