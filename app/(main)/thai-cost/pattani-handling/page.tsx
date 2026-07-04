import { listPattaniHandling } from "@/app/actions/thai-cost-phase2";
import { PattaniHandlingView } from "@/components/thai-cost/PattaniHandlingView";
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
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">北大年搬运 Pattani Handling</h2>
        </div>
        <PattaniHandlingView
          year={year}
          month={month}
          rows={rows}
          canWrite={current ? canWriteThaiCost(current.role) : false}
        />
      </div>
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
