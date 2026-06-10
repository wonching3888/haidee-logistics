import { getDailySummary } from "@/app/actions/summary";
import { SummaryView } from "@/components/summary/SummaryView";
import { PageError } from "@/components/shared/PageError";
import {
  formatDisplayDate,
  parseDateInput,
  resolveDateParam,
} from "@/lib/date-utils";

interface SummaryPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function SummaryPage({ searchParams }: SummaryPageProps) {
  const params = await searchParams;
  const date = resolveDateParam(params.date);
  const displayDate = formatDisplayDate(parseDateInput(date));

  try {
    const data = await getDailySummary(date);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            每日总单 Daily Summary
          </h2>
          <p className="text-sm text-haidee-muted">
            派车货物汇总矩阵 Dispatch cargo summary matrix · {displayDate}
          </p>
        </div>
        <SummaryView date={date} data={data} />
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            每日总单 Daily Summary
          </h2>
          <p className="text-sm text-haidee-muted">{displayDate}</p>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
