import { getStockOverview, getTongLedger } from "@/app/actions/tong";
import { TongStockView } from "@/components/tong/TongStockView";
import { PageError } from "@/components/shared/PageError";
import {
  formatDisplayDate,
  parseDateInput,
  resolveDateParam,
} from "@/lib/date-utils";

interface TongStockPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function TongStockPage({ searchParams }: TongStockPageProps) {
  const params = await searchParams;
  const filterDate = resolveDateParam(params.date);
  const displayDate = formatDisplayDate(parseDateInput(filterDate));

  try {
    const [overview, ledger] = await Promise.all([
      getStockOverview(filterDate),
      getTongLedger(filterDate),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            桶库存 Crate Stock
          </h2>
          <p className="text-sm text-haidee-muted">
            SADAO 实时库存、欠桶记录及流水
          </p>
        </div>

        <TongStockView
          stockRows={overview.stockRows}
          shortages={overview.shortages}
          ledger={ledger}
          filterDate={filterDate}
          displayDate={displayDate}
        />
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            桶库存 Crate Stock
          </h2>
          <p className="text-sm text-haidee-muted">
            SADAO 实时库存、欠桶记录及流水
          </p>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
