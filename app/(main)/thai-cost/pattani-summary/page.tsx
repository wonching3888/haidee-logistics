import {
  getPattaniPnlSummary,
  getDispatchCrossCheck,
  seedPattaniSakriWorker,
} from "@/app/actions/thai-cost-phase2";
import { PattaniSummaryView } from "@/components/thai-cost/PattaniSummaryView";
import { ThaiCostSummaryShell } from "@/components/thai-cost/ThaiCostEntryShell";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser, requirePageUser } from "@/lib/auth";
import { canAccessThaiCost, canWriteThaiCost } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function PattaniSummaryPage({ searchParams }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessThaiCost(user.role)) redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  try {
    const current = await getCurrentUser();
    if (current && canWriteThaiCost(current.role)) {
      await seedPattaniSakriWorker();
    }
    const [pnl, crossCheck] = await Promise.all([
      getPattaniPnlSummary(year, month),
      getDispatchCrossCheck({ year, month, station: "PATTANI" }),
    ]);
    return (
      <ThaiCostSummaryShell
        activeTab="pattani"
        title="月度汇总 · 北大年"
        subtitle="SAKRI 月薪/提成 · 外包 · 司机 · 内部成本对冲"
      >
        <PattaniSummaryView pnl={pnl} crossCheck={crossCheck} />
      </ThaiCostSummaryShell>
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
