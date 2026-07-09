import {
  getPattaniHandlingForDate,
  getSongkhlaHandlingForDate,
  listThaiDrivers,
  seedThaiDriversPhase2,
} from "@/app/actions/thai-cost-phase2";
import {
  getSadaoHandlingForDate,
} from "@/app/actions/thai-cost";
import { UnifiedHandlingView } from "@/components/thai-cost/UnifiedHandlingView";
import { ThaiCostEntryShell } from "@/components/thai-cost/ThaiCostEntryShell";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser, requirePageUser } from "@/lib/auth";
import { canAccessThaiCost, canWriteThaiCost } from "@/lib/auth-roles";
import { getBangkokTodayDateInput } from "@/lib/date-utils";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function UnifiedHandlingPage({ searchParams }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessThaiCost(user.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const date = params.date?.trim() || getBangkokTodayDateInput();

  try {
    const [sadaoRow, songkhlaRow, pattaniRow, current] = await Promise.all([
      getSadaoHandlingForDate(date),
      getSongkhlaHandlingForDate(date),
      getPattaniHandlingForDate(date),
      getCurrentUser(),
    ]);
    const canWrite = current ? canWriteThaiCost(current.role) : false;
    let drivers = await listThaiDrivers();
    if (drivers.length === 0 && canWrite) {
      drivers = await seedThaiDriversPhase2();
    }

    return (
      <ThaiCostEntryShell
        activeTab="handling"
        titleKey="thaiCost.handling.pageTitle"
        subtitleKey="thaiCost.handling.pageSubtitle"
      >
        <UnifiedHandlingView
          date={date}
          sadaoRow={sadaoRow}
          songkhlaRow={songkhlaRow}
          pattaniRow={pattaniRow}
          drivers={drivers}
          canWrite={canWrite}
        />
      </ThaiCostEntryShell>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">{date}</h2>
        <PageError error={error} />
      </div>
    );
  }
}
