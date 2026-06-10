import {
  getShippersForExport,
  getTongTypesForExport,
} from "@/app/actions/tong";
import { TongExportForm } from "@/components/tong/TongExportForm";

export default async function TongExportPage() {
  const [shippers, tongTypes] = await Promise.all([
    getShippersForExport(),
    getTongTypesForExport(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          空桶归还 Empty Crate Export
        </h2>
        <p className="text-sm text-haidee-muted">
          泰国车空桶归还录入及泰文收据 TH vehicle empty crate return
        </p>
      </div>
      <TongExportForm shippers={shippers} tongTypes={tongTypes} />
    </div>
  );
}
