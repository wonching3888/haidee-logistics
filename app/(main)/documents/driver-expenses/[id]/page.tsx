import { redirect } from "next/navigation";
import { DriverVoucherForm } from "@/components/driver-expenses/DriverVoucherForm";
import { getCurrentUser } from "@/lib/auth";
import { canAccessDriverExpenses } from "@/lib/auth-roles";
import { resolveDateParam } from "@/lib/date-utils";
import { getDefaultRoute } from "@/lib/routes";

export const dynamic = "force-dynamic";

interface EditVoucherPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}

export default async function EditDriverVoucherPage({
  params,
  searchParams,
}: EditVoucherPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessDriverExpenses(user.role)) {
    redirect(getDefaultRoute(user.role));
  }

  const { id } = await params;
  const sp = await searchParams;
  const date = resolveDateParam(sp.date);

  return <DriverVoucherForm mode="edit" date={date} voucherId={id} />;
}
