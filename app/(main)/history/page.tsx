import { Suspense } from "react";
import { getHistoryAuditFeed } from "@/app/actions/history";
import { HistoryView } from "@/components/history/HistoryView";
import { resolveDateParam } from "@/lib/date-utils";
import type { HistoryTab } from "@/lib/audit-feed";

interface HistoryPageProps {
  searchParams: Promise<{ date?: string; tab?: string }>;
}

function parseTab(tab?: string): HistoryTab {
  if (
    tab === "inbound" ||
    tab === "payroll" ||
    tab === "voucher" ||
    tab === "trips"
  ) {
    return tab;
  }
  return "all";
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;
  const filterDate = params.date ? resolveDateParam(params.date) : "";
  const tab = parseTab(params.tab);
  const records = await getHistoryAuditFeed({
    tab,
    date: params.date || undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          修改记录 Modification History
        </h2>
        <p className="text-sm text-haidee-muted">
          进货 · 工资 · 费用单 · 派车/包车修改汇总
        </p>
      </div>

      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-haidee-border/30" />}>
        <HistoryView records={records} filterDate={filterDate} activeTab={tab} />
      </Suspense>
    </div>
  );
}
