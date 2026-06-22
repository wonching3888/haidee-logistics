import { getCrateImportPageData } from "@/app/actions/tong";
import { TongImportForm } from "@/components/tong/TongImportForm";
import { toDateInputValue } from "@/lib/inbound-utils";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n/translate";

export default async function TongImportPage() {
  const todayDate = toDateInputValue(new Date());
  const data = await getCrateImportPageData(todayDate);
  const user = await getCurrentUser();
  const locale = user?.language ?? "zh";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          {t("nav.crateImport", locale)}
        </h2>
        <p className="text-sm text-haidee-muted">
          {t("crateImport.pageSubtitle", locale)}
        </p>
      </div>
      <TongImportForm
        allTrucks={data.trucks}
        markets={data.markets}
        crateTypes={data.crateTypes}
        initialDate={todayDate}
        initialRows={data.rows}
        initialDynamicColumns={data.dynamicColumns}
        initialDispatchedPlates={data.dispatchedPlates}
        initialInTransitRows={data.inTransitRows}
        initialInTransitDynamicColumns={data.inTransitDynamicColumns}
      />
    </div>
  );
}
