import { getCrateReport } from "@/app/actions/crate-report";
import { PeriodReportView } from "@/components/reports/PeriodReportView";
import { PageError } from "@/components/shared/PageError";
import {
  parseReportMode,
  parseReportMonth,
  parseReportYear,
} from "@/lib/reports/parse-report-params";
import { isReportQueryRequested } from "@/lib/reports/report-query-params";

export const dynamic = "force-dynamic";

interface CrateReportPageProps {
  searchParams: Promise<{
    mode?: string;
    year?: string;
    month?: string;
    q?: string;
  }>;
}

export default async function CrateReportPage({
  searchParams,
}: CrateReportPageProps) {
  const params = await searchParams;
  const mode = parseReportMode(params.mode);
  const year = parseReportYear(params.year);
  const month = parseReportMonth(params.month);
  const queried = isReportQueryRequested(params);

  try {
    const data = queried
      ? await getCrateReport({
          mode,
          year,
          month: mode === "monthly" ? month : undefined,
        })
      : null;

    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col gap-6">
        <div className="shrink-0">
          <h2 className="text-2xl font-bold text-haidee-text">
            桶型报表 Crate Report
          </h2>
          <p className="text-sm text-haidee-muted">
            按桶型汇总派车数量（实时自数据库读取）Crate totals from dispatch data
          </p>
        </div>
        <div className="min-h-0 min-w-0 flex-1">
          <PeriodReportView
            basePath="/reports/crate"
            reportTitle="桶型报表"
            reportTitleEn="Crate Report"
            emptyMessage="所选期间暂无派车货量 No dispatch quantities for this period"
            awaitingQueryMessage={
              <>
                请选择报表类型与期间，点击「查询」加载桶型报表。
                <br />
                Choose report type and period, then click Search.
              </>
            }
            documentTitlePrefix="CrateReport"
            mode={mode}
            year={year}
            month={month}
            data={data}
            queried={queried}
          />
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            桶型报表 Crate Report
          </h2>
          <p className="text-sm text-haidee-muted">
            按桶型汇总派车数量 Crate totals from dispatch data
          </p>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
