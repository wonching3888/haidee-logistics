import { notFound } from "next/navigation";
import { getCrateExportReceiptData } from "@/app/actions/crateExport";
import { DOPrintPageLayout } from "@/components/documents/DOPrintPageLayout";
import { PageError } from "@/components/shared/PageError";
import { TongExportReceipt } from "@/components/tong/TongExportReceipt";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";

interface CrateExportPrintPageProps {
  searchParams: Promise<{
    exportNo?: string;
    returnTo?: string;
  }>;
}

function resolveBackHref(returnTo: string | undefined): string {
  const trimmed = returnTo?.trim();
  if (trimmed && trimmed.startsWith("/")) return trimmed;
  return "/crate/export";
}

export default async function CrateExportPrintPage({
  searchParams,
}: CrateExportPrintPageProps) {
  const params = await searchParams;
  const exportNo = params.exportNo?.trim();
  if (!exportNo) notFound();

  const backHref = resolveBackHref(params.returnTo);
  const user = await getCurrentUser();
  const locale = user?.language ?? "zh";

  try {
    const data = await getCrateExportReceiptData(exportNo);
    if (!data) notFound();

    return (
      <DOPrintPageLayout
        title={t("crateExport.receiptTitle", locale)}
        documentTitle={data.exportNo}
        backHref={backHref}
      >
        <TongExportReceipt data={data} />
      </DOPrintPageLayout>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-haidee-text">
          {t("crateExport.receiptTitle", locale)}
        </h2>
        <PageError error={error} />
      </div>
    );
  }
}
