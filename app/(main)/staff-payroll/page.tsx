import { getStaffPayrollStaff } from "@/app/actions/staff-payroll";
import { StaffPayrollView } from "@/components/staff-payroll/StaffPayrollView";
import { PageError } from "@/components/shared/PageError";

interface StaffPayrollPageProps {
  searchParams: Promise<{ staffId?: string; year?: string; month?: string }>;
}

export default async function StaffPayrollPage({
  searchParams,
}: StaffPayrollPageProps) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  try {
    const staff = await getStaffPayrollStaff({ year, month });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            员工工资单 Staff Payroll
          </h2>
          <p className="text-sm text-haidee-muted">
            WTL Express 固定月薪 · 法定扣款 · PCB（empty YTD 起步）
          </p>
        </div>

        <StaffPayrollView
          staff={staff.map((s) => ({ id: s.id, name: s.name }))}
          initialStaffId={params.staffId}
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
            员工工资单 Staff Payroll
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
