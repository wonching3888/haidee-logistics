import { getMarketReport, type MarketReportMode } from "@/app/actions/market-report";
import { MarketReportView } from "@/components/market-report/MarketReportView";
import { PageError } from "@/components/shared/PageError";

export const dynamic = "force-dynamic";

interface MarketReportPageProps {
  searchParams: Promise<{
    mode?: string;
    year?: string;
    month?: string;
  }>;
}

function parseMode(raw?: string): MarketReportMode {
  return raw === "yearly" ? "yearly" : "monthly";
}

function parseYear(raw?: string): number {
  const year = Number(raw);
  if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
    return year;
  }
  return new Date().getFullYear();
}

function parseMonth(raw?: string): number {
  const month = Number(raw);
  if (Number.isInteger(month) && month >= 1 && month <= 12) {
    return month;
  }
  return new Date().getMonth() + 1;
}

export default async function MarketReportPage({
  searchParams,
}: MarketReportPageProps) {
  const params = await searchParams;
  const mode = parseMode(params.mode);
  const year = parseYear(params.year);
  const month = parseMonth(params.month);

  try {
    const data = await getMarketReport({
      mode,
      year,
      month: mode === "monthly" ? month : undefined,
    });

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
          <MarketReportView
            mode={mode}
            year={year}
            month={month}
            data={data}
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
