import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getShippersForExport,
  getTongTypesForExport,
} from "@/app/actions/tong";
import { getCrateExportForEdit } from "@/app/actions/crateExport";
import { TongExportForm } from "@/components/tong/TongExportForm";
import { PageError } from "@/components/shared/PageError";

export const dynamic = "force-dynamic";

interface CrateExportEditPageProps {
  searchParams: Promise<{ exportNo?: string }>;
}

export default async function CrateExportEditPage({
  searchParams,
}: CrateExportEditPageProps) {
  const params = await searchParams;
  const exportNo = params.exportNo?.trim();
  if (!exportNo) notFound();

  try {
    const [shippers, tongTypes, initialData] = await Promise.all([
      getShippersForExport(),
      getTongTypesForExport(),
      getCrateExportForEdit(exportNo),
    ]);

    if (!initialData) notFound();

    const returnHref = `/crate/export?date=${encodeURIComponent(initialData.date)}`;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-haidee-text">
              编辑归还单 Edit Export
            </h2>
            <p className="text-sm text-haidee-muted">
              {initialData.exportNo} · 寄货人/日期不可改 Consignor & date locked
            </p>
          </div>
          <Link
            href={returnHref}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-haidee-border px-4 text-sm text-haidee-text hover:bg-haidee-surface"
          >
            返回列表 Back to list
          </Link>
        </div>

        <TongExportForm
          mode="edit"
          exportNo={initialData.exportNo}
          initialData={initialData}
          shippers={shippers}
          tongTypes={tongTypes}
        />
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            编辑归还单 Edit Export
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
