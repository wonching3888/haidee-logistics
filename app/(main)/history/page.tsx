import { Suspense } from "react";
import { getInboundModifications } from "@/app/actions/history";
import { HistoryView } from "@/components/history/HistoryView";
import { resolveDateParam } from "@/lib/date-utils";

interface HistoryPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;
  const filterDate = params.date ? resolveDateParam(params.date) : "";
  const records = await getInboundModifications(params.date || undefined);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          修改记录 Modification History
        </h2>
        <p className="text-sm text-haidee-muted">
          进货记录修改前后对比 Inbound change log
        </p>
      </div>

      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-haidee-border/30" />}>
        <HistoryView records={records} filterDate={filterDate} />
      </Suspense>
    </div>
  );
}
