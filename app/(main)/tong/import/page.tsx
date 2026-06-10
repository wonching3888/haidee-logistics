import { getMarketsForImport, getTrucksForImport } from "@/app/actions/tong";
import { TongImportForm } from "@/components/tong/TongImportForm";

export default async function TongImportPage() {
  const [trucks, markets] = await Promise.all([
    getTrucksForImport(),
    getMarketsForImport(),
  ]);

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
      <TongImportForm trucks={trucks} markets={markets} />
    </div>
  );
}
