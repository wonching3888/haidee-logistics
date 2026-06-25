import { redirect } from "next/navigation";
import { DriverExpensesClient } from "@/components/driver-expenses/DriverExpensesClient";
import { DriverExpensesPageHeader } from "@/components/driver-expenses/DriverExpensesPageHeader";
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
      <DriverExpensesPageHeader />
      <DriverExpensesClient initialDate={date} userRole={user.role} />
    </div>
  );
}
