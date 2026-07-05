import { listSongkhlaHandling } from "@/app/actions/thai-cost-phase2";
import { SongkhlaHandlingView } from "@/components/thai-cost/SongkhlaHandlingView";
import { ThaiCostEntryShell } from "@/components/thai-cost/ThaiCostEntryShell";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser, requirePageUser } from "@/lib/auth";
import { canAccessThaiCost, canWriteThaiCost } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function SongkhlaHandlingPage({ searchParams }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessThaiCost(user.role)) redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  try {
    const [rows, current] = await Promise.all([
      listSongkhlaHandling({ year, month }),
      getCurrentUser(),
    ]);
    return (
      <ThaiCostEntryShell activeTab="songkhla" title="数据录入 · 宋卡搬运">
        <SongkhlaHandlingView
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
