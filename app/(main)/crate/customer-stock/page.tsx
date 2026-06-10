import { Suspense } from "react";
import { getCustomerCrateStock } from "@/app/actions/customerCrateStock";
import { CustomerCrateStockView } from "@/components/crate/CustomerCrateStockView";
import { PageError } from "@/components/shared/PageError";

interface CustomerCrateStockPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function CustomerCrateStockPage({
  searchParams,
}: CustomerCrateStockPageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";

  try {
    const { crateTypes, rows } = await getCustomerCrateStock(search);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            顾客桶库存 Customer Crate Stock
          </h2>
          <p className="text-sm text-haidee-muted">
            各寄货人桶型库存管理 Per-shipper crate inventory
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
            顾客桶库存 Customer Crate Stock
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
