import { listPattaniHandling } from "@/app/actions/thai-cost-phase2";
import { PattaniHandlingView } from "@/components/thai-cost/PattaniHandlingView";
import { ThaiCostEntryShell } from "@/components/thai-cost/ThaiCostEntryShell";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser, requirePageUser } from "@/lib/auth";
import { canAccessThaiCost, canWriteThaiCost } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function PattaniHandlingPage({ searchParams }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessThaiCost(user.role)) redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  try {
    const [rows, current] = await Promise.all([
      listPattaniHandling({ year, month }),
      getCurrentUser(),
    ]);
    return (
      <ThaiCostEntryShell
        activeTab="pattani"
        titleKey="thaiCost.pattaniHandling.pageTitle"
        subtitleKey="thaiCost.pattaniHandling.pageSubtitle"
      >
        <PattaniHandlingView
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
