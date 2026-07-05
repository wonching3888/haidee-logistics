import { listThaiRentedVehicleTrips } from "@/app/actions/thai-cost-phase2";
import { RentedVehiclesView } from "@/components/thai-cost/RentedVehiclesView";
import { ThaiCostEntryShell } from "@/components/thai-cost/ThaiCostEntryShell";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser, requirePageUser } from "@/lib/auth";
import { canAccessThaiCost, canWriteThaiCost } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function RentedVehiclesPage({ searchParams }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessThaiCost(user.role)) redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  try {
    const [rows, current] = await Promise.all([
      listThaiRentedVehicleTrips({ year, month }),
      getCurrentUser(),
    ]);
    return (
      <ThaiCostEntryShell
        activeTab="rented"
        title="数据录入 · 外部租车"
        subtitle="BANHENG / SHS / YIN 等外部租车按趟费用"
      >
        <RentedVehiclesView
          year={year}
          month={month}
          rows={rows}
          canWrite={current ? canWriteThaiCost(current.role) : false}
        />
      </ThaiCostEntryShell>
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
