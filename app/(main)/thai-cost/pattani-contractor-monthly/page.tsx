import { getPattaniContractorMonthly } from "@/app/actions/thai-cost-phase2";
import { PattaniContractorMonthlyView } from "@/components/thai-cost/PattaniContractorMonthlyView";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser, requirePageUser } from "@/lib/auth";
import { canAccessThaiCost, canWriteThaiCost } from "@/lib/auth-roles";
import { redirect } from "next/navigation";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function PattaniContractorMonthlyPage({
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
    const [summary, current] = await Promise.all([
      getPattaniContractorMonthly({ year, month }),
      getCurrentUser(),
    ]);
    const canPrint = current ? canWriteThaiCost(current.role) : false;

    return (
      <div className="space-y-6">
        <div>
          <Link
            href={`/thai-cost/handling?date=${year}-${String(month).padStart(2, "0")}-01`}
            className="text-sm text-haidee-blue underline"
          >
            ← Handling entry
          </Link>
        </div>
        <PattaniContractorMonthlyView summary={summary} canPrint={canPrint} />
      </div>
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
