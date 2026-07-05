import { getSongkhlaPnlSummary, getDispatchCrossCheck } from "@/app/actions/thai-cost-phase2";
import { SongkhlaSummaryView } from "@/components/thai-cost/SongkhlaSummaryView";
import { ThaiCostSummaryShell } from "@/components/thai-cost/ThaiCostEntryShell";
import { PageError } from "@/components/shared/PageError";
import { requirePageUser } from "@/lib/auth";
import { canAccessThaiCostMonthlySummary } from "@/lib/auth-roles";
import { getDefaultRoute } from "@/lib/routes";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function SongkhlaSummaryPage({ searchParams }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessThaiCostMonthlySummary(user.role)) {
    redirect(getDefaultRoute(user.role));
  }

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  try {
    const [pnl, crossCheck] = await Promise.all([
      getSongkhlaPnlSummary(year, month),
      getDispatchCrossCheck({ year, month, station: "SONGKHLA" }),
    ]);
    return (
      <ThaiCostSummaryShell
        activeTab="songkhla"
        titleKey="thaiCost.songkhlaSummary.pageTitle"
        subtitleKey="thaiCost.songkhlaSummary.pageSubtitle"
      >
        <SongkhlaSummaryView pnl={pnl} crossCheck={crossCheck} />
      </ThaiCostSummaryShell>
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
