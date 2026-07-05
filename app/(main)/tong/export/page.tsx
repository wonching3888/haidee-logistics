import { Suspense } from "react";
import {
  getShippersForExport,
  getTongTypesForExport,
} from "@/app/actions/tong";
import {
  getCrateExportDueTodayForDate,
  listCrateExportsForDate,
} from "@/app/actions/crateExport";
import { CrateExportWorkbench } from "@/components/tong/CrateExportWorkbench";
import { CrateExportDateFilter } from "@/components/tong/CrateExportDateFilter";
import { CrateExportListTable } from "@/components/tong/CrateExportListTable";
import { CrateExportUpdatedBanner } from "@/components/tong/CrateExportUpdatedBanner";
import { PageError } from "@/components/shared/PageError";
import {
  isLiveCrateExportDueDate,
  resolveCrateExportDueDate,
  resolveCrateExportListDate,
} from "@/lib/crate-export-list";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";

interface TongExportPageProps {
  searchParams: Promise<{ date?: string; due?: string; updated?: string }>;
}

export default async function TongExportPage({
  searchParams,
}: TongExportPageProps) {
  const params = await searchParams;
  const listDate = resolveCrateExportListDate(params.date);
  const dueDate = resolveCrateExportDueDate(params.due);
  const dueInteractive = isLiveCrateExportDueDate(dueDate);
  const user = await getCurrentUser();
  const locale = user?.language ?? "zh";

  try {
    const [shippers, tongTypes, exports, dueToday] = await Promise.all([
      getShippersForExport(),
      getTongTypesForExport(),
      listCrateExportsForDate(listDate),
      getCrateExportDueTodayForDate(dueDate),
    ]);

    return (
      <div className="space-y-6 md:space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            {t("nav.crateExport", locale)}
          </h2>
          <p className="text-sm text-haidee-muted">
            {t("crateExport.pageSubtitle", locale)}
          </p>
        </div>

        <CrateExportWorkbench
          dueToday={dueToday}
          dueInteractive={dueInteractive}
          shippers={shippers}
          tongTypes={tongTypes}
        />

        <section className="space-y-4 rounded-xl border border-haidee-border bg-white p-4 shadow-sm">
          <div>
            <h3 className="text-lg font-semibold text-haidee-text">
              {t("crateExport.todayReturns", locale)}
            </h3>
            <p className="text-sm text-haidee-muted">
              {t("crateExport.listHint", locale)}
            </p>
          </div>

          <Suspense
            fallback={
              <div className="h-16 animate-pulse rounded-lg bg-haidee-border/30" />
            }
          >
            <CrateExportDateFilter />
          </Suspense>

          <Suspense fallback={null}>
            <CrateExportUpdatedBanner />
          </Suspense>

          <CrateExportListTable rows={exports} listDate={listDate} />
        </section>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            {t("nav.crateExport", locale)}
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
