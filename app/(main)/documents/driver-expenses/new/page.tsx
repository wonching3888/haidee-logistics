import { redirect } from "next/navigation";
import { DriverVoucherForm } from "@/components/driver-expenses/DriverVoucherForm";
import { getCurrentUser } from "@/lib/auth";
import { resolveDateParam } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

interface NewVoucherPageProps {
  searchParams: Promise<{ date?: string; tripId?: string }>;
}

export default async function NewDriverVoucherPage({
  searchParams,
}: NewVoucherPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const date = resolveDateParam(params.date);

  return (
    <DriverVoucherForm
      mode="new"
      date={date}
      initialTripId={params.tripId}
    />
  );
}
