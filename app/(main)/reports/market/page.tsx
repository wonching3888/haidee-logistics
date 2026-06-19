import { getMarketReport } from "@/app/actions/market-report";
import { PeriodReportView } from "@/components/reports/PeriodReportView";
import { PageError } from "@/components/shared/PageError";
import {
  parseReportMode,
  parseReportMonth,
  parseReportYear,
} from "@/lib/reports/parse-report-params";
import { isReportQueryRequested } from "@/lib/reports/report-query-params";

export const dynamic = "force-dynamic";

interface MarketReportPageProps {
  searchParams: Promise<{
    mode?: string;
    year?: string;
    month?: string;
    q?: string;
  }>;
}

export default async function MarketReportPage({
  searchParams,
}: MarketReportPageProps) {
  const params = await searchParams;
  const mode = parseReportMode(params.mode);
  const year = parseReportYear(params.year);
  const month = parseReportMonth(params.month);
  const queried = isReportQueryRequested(params);

  try {
    const data = queried
      ? await getMarketReport({
          mode,
          year,
          month: mode === "monthly" ? month : undefined,
        })
      : null;

    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col gap-6">
        <div className="shrink-0">
          <h2 className="text-2xl font-bold text-haidee-text">
            市场报表 Market Report
          </h2>
          <p className="text-sm text-haidee-muted">
            按市场汇总派车桶数（实时自数据库读取）Market totals from dispatch data
          </p>
        </div>
        <div className="min-h-0 min-w-0 flex-1">
          <PeriodReportView
            basePath="/reports/market"
            reportTitle="市场报表"
            reportTitleEn="Market Report"
            emptyMessage="所选期间暂无派车货量 No dispatch quantities for this period"
            awaitingQueryMessage={
              <>
                请选择报表类型（月度/年度）与期间，点击「查询」加载市场报表。
                <br />
                Choose report type and period, then click Search.
              </>
            }
            documentTitlePrefix="MarketReport"
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
            市场报表 Market Report
          </h2>
          <p className="text-sm text-haidee-muted">
            按市场汇总派车桶数 Market totals from dispatch data
          </p>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
