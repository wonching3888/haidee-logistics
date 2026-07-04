import {
  listThaiDrivers,
  listThaiDriverTrips,
  seedThaiDriversPhase2,
} from "@/app/actions/thai-cost-phase2";
import { DriverTripsView } from "@/components/thai-cost/DriverTripsView";
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
    const trips = await listThaiDriverTrips({ year, month });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">泰国司机趟次 Driver Trips</h2>
        </div>
        <DriverTripsView
          year={year}
          month={month}
          drivers={drivers}
          trips={trips}
          canWrite={canWrite}
        />
      </div>
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
