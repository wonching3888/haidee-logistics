import { getCrateImportPageData } from "@/app/actions/tong";
import { TongImportForm } from "@/components/tong/TongImportForm";
import { toDateInputValue } from "@/lib/inbound-utils";

export default async function TongImportPage() {
  const date = toDateInputValue(new Date());
  const data = await getCrateImportPageData(date);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          空桶回收 Empty Crate Import
        </h2>
        <p className="text-sm text-haidee-muted">
          马来西亚车回程空桶回收录入 MY truck return entry
        </p>
      </div>
      <TongImportForm
        allTrucks={data.trucks}
        markets={data.markets}
        crateTypes={data.crateTypes}
        initialDate={date}
        initialRows={data.rows}
        initialDynamicColumns={data.dynamicColumns}
        initialDispatchedPlates={data.dispatchedPlates}
      />
    </div>
  );
}
