import { getDashboardData } from "@/app/actions/dashboard";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getCurrentUser } from "@/lib/auth";
import { resolveDateParam } from "@/lib/inbound-utils";

interface DashboardPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const date = resolveDateParam(params.date);
  const [user, data] = await Promise.all([
    getCurrentUser(),
    getDashboardData(date),
  ]);

  return (
    <DashboardView
      {...data}
      userName={user?.name ?? user?.email}
    />
  );
}
