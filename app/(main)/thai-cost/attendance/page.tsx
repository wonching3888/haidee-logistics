import {
  getThaiDailyLaborRoster,
  listThaiDailyAttendance,
} from "@/app/actions/thai-cost";
import { DailyAttendanceView } from "@/components/thai-cost/DailyAttendanceView";
import { ThaiCostEntryShell } from "@/components/thai-cost/ThaiCostEntryShell";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser, requirePageUser } from "@/lib/auth";
import { canAccessThaiCost, canWriteThaiCost } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function ThaiCostAttendancePage({
  searchParams,
}: PageProps) {
  const user = await requirePageUser();
  if (!canAccessThaiCost(user.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  try {
    const [rows, roster, current] = await Promise.all([
      listThaiDailyAttendance({ year, month }),
      getThaiDailyLaborRoster({ year, month, station: "SADAO" }),
      getCurrentUser(),
    ]);
    const canWrite = current ? canWriteThaiCost(current.role) : false;

    return (
      <ThaiCostEntryShell
        activeTab="attendance"
        titleKey="thaiCost.attendance.pageTitle"
        subtitleKey="thaiCost.attendance.pageSubtitle"
      >
        <DailyAttendanceView
          year={year}
          month={month}
          rows={rows}
          roster={roster}
          canWrite={canWrite}
        />
      </ThaiCostEntryShell>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            日薪出勤 Daily Attendance
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
