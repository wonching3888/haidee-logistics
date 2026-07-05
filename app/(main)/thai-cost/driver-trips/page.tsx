import {
  getVehicleTripPlForMonth,
  listThaiDrivers,
  listThaiVehicleTrips,
  seedThaiDriversPhase2,
} from "@/app/actions/thai-cost-phase2";
import { DriverTripDailyView } from "@/components/thai-cost/DriverTripDailyView";
import { ThaiCostEntryShell } from "@/components/thai-cost/ThaiCostEntryShell";
import { VehiclePlTable } from "@/components/thai-cost/VehiclePlTable";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser, requirePageUser } from "@/lib/auth";
import { canAccessThaiCost, canWriteThaiCost } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function DriverTripsPage({ searchParams }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessThaiCost(user.role)) redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  try {
    let drivers = await listThaiDrivers();
    const current = await getCurrentUser();
    const canWrite = current ? canWriteThaiCost(current.role) : false;
    if (drivers.length === 0 && canWrite) {
      drivers = await seedThaiDriversPhase2();
    }
    const [trips, vehiclePl] = await Promise.all([
      listThaiVehicleTrips({ year, month }),
      getVehicleTripPlForMonth({ year, month }),
    ]);

    return (
      <ThaiCostEntryShell
        activeTab="driver-trips"
        title="数据录入 · 司机趟次"
        subtitle="泰国司机/车辆日常趟次录入（独立于 Dispatch）"
      >
        <DriverTripDailyView
          year={year}
          month={month}
          drivers={drivers}
          trips={trips}
          canWrite={canWrite}
        />
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">当月车辆盈亏</h3>
          <VehiclePlTable rows={vehiclePl} />
        </div>
      </ThaiCostEntryShell>
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
