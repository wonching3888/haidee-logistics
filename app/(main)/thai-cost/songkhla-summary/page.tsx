import { getSongkhlaPnlSummary } from "@/app/actions/thai-cost-phase2";
import { SongkhlaSummaryView } from "@/components/thai-cost/SongkhlaSummaryView";
import { PageError } from "@/components/shared/PageError";
import { requirePageUser } from "@/lib/auth";
import { canAccessThaiCost } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function SongkhlaSummaryPage({ searchParams }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessThaiCost(user.role)) redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  try {
    const pnl = await getSongkhlaPnlSummary(year, month);
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            宋卡月度汇总 Songkhla P&L
          </h2>
          <p className="text-sm text-haidee-muted">
            内部固定成本快照 − 宋卡真实成本（工人+司机）
          </p>
        </div>
        <SongkhlaSummaryView pnl={pnl} />
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">宋卡月度汇总</h2>
        <PageError error={error} />
      </div>
    );
  }
}
