import { getCrateReturnMarketReport } from "@/app/actions/crate-return-report";
import { PeriodReportView } from "@/components/reports/PeriodReportView";
import { PageError } from "@/components/shared/PageError";
import {
  parseReportMode,
  parseReportMonth,
  parseReportYear,
} from "@/lib/reports/parse-report-params";
import { isReportQueryRequested } from "@/lib/reports/report-query-params";

export const dynamic = "force-dynamic";

interface CrateReturnMarketReportPageProps {
  searchParams: Promise<{
    mode?: string;
    year?: string;
    month?: string;
    q?: string;
  }>;
}

export default async function CrateReturnMarketReportPage({
  searchParams,
}: CrateReturnMarketReportPageProps) {
  const params = await searchParams;
  const mode = parseReportMode(params.mode);
  const year = parseReportYear(params.year);
  const month = parseReportMonth(params.month);
  const queried = isReportQueryRequested(params);

  try {
    const data = queried
      ? await getCrateReturnMarketReport({
          mode,
          year,
          month: mode === "monthly" ? month : undefined,
        })
      : null;

    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col gap-6">
        <div className="shrink-0">
          <h2 className="text-2xl font-bold text-haidee-text">
            回收桶市场报表 Crate Return Market Report
          </h2>
          <p className="text-sm text-haidee-muted">
            按市场汇总回收桶数量（实时自数据库读取）Crate return totals by market
          </p>
        </div>
        <div className="min-h-0 min-w-0 flex-1">
          <PeriodReportView
            basePath="/reports/crate-return-market"
            reportTitle="回收桶市场报表"
            reportTitleEn="Crate Return Market Report"
            emptyMessage="所选期间暂无回收桶货量 No crate return quantities for this period"
            awaitingQueryMessage={
              <>
                请选择报表类型（月度/年度）与期间，点击「查询」加载回收桶市场报表。
                <br />
                Choose report type and period, then click Search.
              </>
            }
            documentTitlePrefix="CrateReturnMarketReport"
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
            回收桶市场报表 Crate Return Market Report
          </h2>
          <p className="text-sm text-haidee-muted">
            按市场汇总回收桶数量 Crate return totals by market
          </p>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
