import { listSadaoHandling } from "@/app/actions/thai-cost";
import { SadaoHandlingView } from "@/components/thai-cost/SadaoHandlingView";
import { HandlingEntryBanner } from "@/components/thai-cost/handling/HandlingEntryBanner";
import { ThaiCostEntryShell } from "@/components/thai-cost/ThaiCostEntryShell";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser, requirePageUser } from "@/lib/auth";
import { canAccessThaiCost, canWriteThaiCost } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function SadaoHandlingPage({ searchParams }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessThaiCost(user.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  try {
    const [rows, current] = await Promise.all([
      listSadaoHandling({ year, month }),
      getCurrentUser(),
    ]);
    const canWrite = current ? canWriteThaiCost(current.role) : false;

    return (
      <ThaiCostEntryShell
        activeTab="handling"
        titleKey="thaiCost.sadaoHandling.historyTitle"
        subtitleKey="thaiCost.sadaoHandling.pageSubtitle"
      >
        <HandlingEntryBanner />
        <SadaoHandlingView
          year={year}
          month={month}
          rows={rows}
          canWrite={canWrite}
          historyOnly
        />
      </ThaiCostEntryShell>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            Sadao 搬运 Handling
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
