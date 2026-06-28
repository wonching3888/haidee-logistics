import {
  getDriverPayrollDrivers,
} from "@/app/actions/driver-payroll";
import { DriverPayrollView } from "@/components/driver-payroll/DriverPayrollView";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser } from "@/lib/auth";
import { canExportPayrollJv } from "@/lib/auth-roles";
import type { UserRole } from "@/types";

interface DriverPayrollPageProps {
  searchParams: Promise<{ driverId?: string; year?: string; month?: string }>;
}

export default async function DriverPayrollPage({
  searchParams,
}: DriverPayrollPageProps) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  try {
    const [drivers, user] = await Promise.all([
      getDriverPayrollDrivers(),
      getCurrentUser(),
    ]);
    const canExportJv = user
      ? canExportPayrollJv(user.role as UserRole)
      : false;

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
          canExportJv={canExportJv}
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
