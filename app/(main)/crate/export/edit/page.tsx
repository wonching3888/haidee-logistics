import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getShippersForExport,
  getTongTypesForExport,
} from "@/app/actions/tong";
import { getCrateExportForEdit } from "@/app/actions/crateExport";
import { TongExportForm } from "@/components/tong/TongExportForm";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n/translate";

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

  const user = await getCurrentUser();
  const locale = user?.language ?? "zh";

  try {
    const [shippers, tongTypes, initialData] = await Promise.all([
      getShippersForExport(),
      getTongTypesForExport(),
      getCrateExportForEdit(exportNo),
    ]);

    if (!initialData) notFound();

    const extraShipper = shippers.some((s) => s.id === initialData.shipperId)
      ? null
      : {
          id: initialData.shipperId,
          code: initialData.shipperCode,
          name: initialData.shipperName,
        };

    const returnHref = `/crate/export?date=${encodeURIComponent(initialData.date)}`;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-haidee-text">
              {t("crateExport.editTitle", locale)}
            </h2>
            <p className="text-sm text-haidee-muted">
              {t("crateExport.editSubtitle", locale, {
                exportNo: initialData.exportNo,
              })}
            </p>
          </div>
          <Link
            href={returnHref}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-haidee-border px-4 text-sm text-haidee-text hover:bg-haidee-surface"
          >
            {t("crateExport.backToList", locale)}
          </Link>
        </div>

        <TongExportForm
          mode="edit"
          exportNo={initialData.exportNo}
          initialData={initialData}
          shippers={shippers}
          tongTypes={tongTypes}
          extraShipper={extraShipper}
        />
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            {t("crateExport.editTitle", locale)}
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
