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
      <div className="flex h-full min-h-0 min-w-0 flex-col gap-6">
        <div className="shrink-0">
          <h2 className="text-2xl font-bold text-haidee-text">
            装车清单 Vehicle Loading List
          </h2>
          <p className="text-sm text-haidee-muted">
            派车后每辆车装载明细 Post-dispatch loading by truck
          </p>
        </div>
        <div className="min-h-0 min-w-0 flex-1">
          <SummaryView date={date} displayDate={displayDate} data={data} />
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="min-w-0 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            装车清单 Vehicle Loading List
          </h2>
          <p className="text-sm text-haidee-muted">
            派车后每辆车装载明细 Post-dispatch loading by truck
          </p>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
