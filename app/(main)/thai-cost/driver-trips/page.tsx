import {
  getVehicleTripPlForMonth,
  listThaiDrivers,
  listThaiVehicleTrips,
  seedThaiDriversPhase2,
} from "@/app/actions/thai-cost-phase2";
import { DriverTripDailyView } from "@/components/thai-cost/DriverTripDailyView";
import { DriverTripsEntryBanner } from "@/components/thai-cost/handling/DriverTripsEntryBanner";
import { ThaiCostEntryShell } from "@/components/thai-cost/ThaiCostEntryShell";
import { ThaiCostSectionTitle } from "@/components/thai-cost/ThaiCostPageHeader";
import { VehiclePlTable } from "@/components/thai-cost/VehiclePlTable";
import { PageError } from "@/components/shared/PageError";
import { requirePageUser } from "@/lib/auth";
import { canAccessThaiCost } from "@/lib/auth-roles";
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
    if (drivers.length === 0) {
      drivers = await seedThaiDriversPhase2();
    }
    const [trips, vehiclePl] = await Promise.all([
      listThaiVehicleTrips({ year, month }),
      getVehicleTripPlForMonth({ year, month }),
    ]);

    return (
      <ThaiCostEntryShell
        activeTab="driver-trips"
        titleKey="thaiCost.driverTrips.pageTitle"
        subtitleKey="thaiCost.driverTrips.pageSubtitle"
      >
        <div className="space-y-6">
          <DriverTripsEntryBanner />
          <DriverTripDailyView
          year={year}
          month={month}
          drivers={drivers}
          trips={trips}
          canWrite={false}
          viewOnly
        />
        <div className="space-y-2">
          <ThaiCostSectionTitle titleKey="thaiCost.driverTrips.vehiclePlTitle" />
          <VehiclePlTable rows={vehiclePl} />
        </div>
        </div>
      </ThaiCostEntryShell>
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
