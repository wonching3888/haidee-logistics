import { Suspense } from "react";
import { getStockOverview, getTongLedger } from "@/app/actions/tong";
import { TongStockView } from "@/components/tong/TongStockView";
import { resolveDateParam } from "@/lib/date-utils";

interface TongStockPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function TongStockPage({ searchParams }: TongStockPageProps) {
  const params = await searchParams;
  const filterDate = resolveDateParam(params.date);

  const [overview, ledger] = await Promise.all([
    getStockOverview(filterDate),
    getTongLedger(params.date),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          桶库存 Crate Stock
        </h2>
        <p className="text-sm text-haidee-muted">
          SADAO 实时库存、欠桶记录及流水 SADAO stock, shortages & ledger
        </p>
      </div>

      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-haidee-border/30" />}>
        <TongStockView
          stockRows={overview.stockRows}
          shortages={overview.shortages}
          ledger={ledger}
          filterDate={filterDate}
        />
      </Suspense>
    </div>
  );
}
