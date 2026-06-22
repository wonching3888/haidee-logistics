import { Suspense } from "react";
import {
  getShippersForExport,
  getTongTypesForExport,
} from "@/app/actions/tong";
import { listCrateExportsForDate } from "@/app/actions/crateExport";
import { TongExportForm } from "@/components/tong/TongExportForm";
import { CrateExportDateFilter } from "@/components/tong/CrateExportDateFilter";
import { CrateExportListTable } from "@/components/tong/CrateExportListTable";
import { PageError } from "@/components/shared/PageError";
import { resolveCrateExportListDate } from "@/lib/crate-export-list";

export const dynamic = "force-dynamic";

interface TongExportPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function TongExportPage({
  searchParams,
}: TongExportPageProps) {
  const params = await searchParams;
  const listDate = resolveCrateExportListDate(params.date);

  try {
    const [shippers, tongTypes, exports] = await Promise.all([
      getShippersForExport(),
      getTongTypesForExport(),
      listCrateExportsForDate(listDate),
    ]);

    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            空桶归还 Empty Crate Export
          </h2>
          <p className="text-sm text-haidee-muted">
            泰国车空桶归还录入及泰文收据 TH vehicle empty crate return
          </p>
        </div>

        <TongExportForm shippers={shippers} tongTypes={tongTypes} />

        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-haidee-text">
              今日归还单 Today&apos;s Returns
            </h3>
            <p className="text-sm text-haidee-muted">
              按日期查看已录入归还单 View saved returns by date
            </p>
          </div>

          <Suspense
            fallback={
              <div className="h-16 animate-pulse rounded-xl bg-haidee-border/30" />
            }
          >
            <CrateExportDateFilter />
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
            空桶归还 Empty Crate Export
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
