import { Suspense } from "react";
import { getCustomerCrateStock } from "@/app/actions/customerCrateStock";
import { CustomerCrateStockView } from "@/components/crate/CustomerCrateStockView";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n/translate";

interface CustomerCrateStockPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function CustomerCrateStockPage({
  searchParams,
}: CustomerCrateStockPageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const user = await getCurrentUser();
  const locale = user?.language ?? "zh";

  try {
    const { crateTypes, rows, pickupLocationSummaries } =
      await getCustomerCrateStock(search);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            {t("nav.customerCrateStock", locale)}
          </h2>
          <p className="text-sm text-haidee-muted">
            {t("customerCrateStock.pageSubtitle", locale)}
          </p>
        </div>

        <Suspense
          fallback={
            <div className="h-64 animate-pulse rounded-xl bg-haidee-border/30" />
          }
        >
          <CustomerCrateStockView
            crateTypes={crateTypes}
            rows={rows}
            pickupLocationSummaries={pickupLocationSummaries}
            initialSearch={search}
          />
        </Suspense>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            {t("nav.customerCrateStock", locale)}
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
