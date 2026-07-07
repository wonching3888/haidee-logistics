import { redirect } from "next/navigation";
import { getCrateStockAnomalies } from "@/app/actions/crate-stock-anomalies";
import { CrateStockAnomaliesView } from "@/components/crate/CrateStockAnomaliesView";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSettings } from "@/lib/auth-roles";

export const dynamic = "force-dynamic";

export default async function CrateStockAnomaliesPage() {
  const user = await getCurrentUser();
  if (!user || !canAccessSettings(user.role)) {
    redirect("/dashboard");
  }

  const result = await getCrateStockAnomalies();

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          桶库存异常 Crate stock anomalies
        </h2>
        <p className="text-sm text-haidee-muted">
          自动巡检：同车重复嫌疑、归还/冲销 location 不一致、非标准 location、SADAO
          单日异常波动（仅管理员）
        </p>
      </div>
      <CrateStockAnomaliesView
        scannedAt={result.scannedAt}
        anomalies={result.anomalies}
        countsByRule={result.countsByRule}
      />
    </div>
  );
}
