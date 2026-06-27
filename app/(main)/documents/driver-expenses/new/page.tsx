import { redirect } from "next/navigation";
import { DriverVoucherForm } from "@/components/driver-expenses/DriverVoucherForm";
import { getCurrentUser } from "@/lib/auth";
import { canAccessDriverExpenses } from "@/lib/auth-roles";
import { resolveDateParam } from "@/lib/date-utils";
import { getDefaultRoute } from "@/lib/routes";

export const dynamic = "force-dynamic";

interface NewVoucherPageProps {
  searchParams: Promise<{ date?: string; tripId?: string; tripSource?: string }>;
}

export default async function NewDriverVoucherPage({
  searchParams,
}: NewVoucherPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessDriverExpenses(user.role)) {
    redirect(getDefaultRoute(user.role));
  }
  const params = await searchParams;
  const date = resolveDateParam(params.date);

  if (!params.tripId) {
    redirect(`/documents/driver-expenses?date=${date}`);
  }

  if (user.role === "my_accounting") {
    redirect(`/documents/driver-expenses?date=${date}`);
  }

  return (
    <DriverVoucherForm
      mode="new"
      date={date}
      initialTripId={params.tripId}
      initialTripSource={
        params.tripSource === "charter" ? "charter" : "dispatch"
      }
      userRole={user.role}
    />
  );
}
