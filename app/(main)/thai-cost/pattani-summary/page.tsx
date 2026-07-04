import {
  getPattaniPnlSummary,
  seedPattaniSakriWorker,
} from "@/app/actions/thai-cost-phase2";
import { PattaniSummaryView } from "@/components/thai-cost/PattaniSummaryView";
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
    const pnl = await getPattaniPnlSummary(year, month);
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">北大年月度汇总 Pattani P&L</h2>
          <p className="text-sm text-haidee-muted">
            SAKRI 月薪/提成 · 外包 · 司机 · 内部成本对冲
          </p>
        </div>
        <PattaniSummaryView pnl={pnl} />
      </div>
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
