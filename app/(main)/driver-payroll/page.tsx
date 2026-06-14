import { redirect } from "next/navigation";
import {
  getDriverPayrollDrivers,
} from "@/app/actions/driver-payroll";
import { DriverPayrollView } from "@/components/driver-payroll/DriverPayrollView";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser } from "@/lib/auth";
import { canAccessDriverPayroll } from "@/lib/auth-roles";
import type { UserRole } from "@/types";

interface DriverPayrollPageProps {
  searchParams: Promise<{ driverId?: string; year?: string; month?: string }>;
}

export default async function DriverPayrollPage({
  searchParams,
}: DriverPayrollPageProps) {
  const user = await getCurrentUser();
  if (!user || !canAccessDriverPayroll(user.role as UserRole)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  try {
    const drivers = await getDriverPayrollDrivers();

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            司机薪资 Driver Payroll
          </h2>
          <p className="text-sm text-haidee-muted">
            马来西亚司机月薪 · 趟次津贴 · 法定扣款 · AutoCount 导出
          </p>
        </div>

        <DriverPayrollView
          drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
          initialDriverId={params.driverId}
          initialYear={year}
          initialMonth={month}
        />
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            司机薪资 Driver Payroll
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
