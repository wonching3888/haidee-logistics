import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import {
  getDispatchOrders,
  getUnassignedMatrix,
} from "@/app/actions/dispatch";
import { DispatchMatrix } from "@/components/dispatch/DispatchMatrix";
import { DispatchOrderList } from "@/components/dispatch/DispatchOrderList";
import { DispatchDateFilter } from "@/components/dispatch/DispatchDateFilter";
import { PageError } from "@/components/shared/PageError";
import {
  formatDisplayDate,
  parseDateInput,
  resolveDateParam,
} from "@/lib/date-utils";

interface DispatchPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function DispatchPage({ searchParams }: DispatchPageProps) {
  const params = await searchParams;
  const date = resolveDateParam(params.date);
  const displayDate = formatDisplayDate(parseDateInput(date));

  try {
    const [matrix, orders] = await Promise.all([
      getUnassignedMatrix(date),
      getDispatchOrders(date),
    ]);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-haidee-text">
              派车调度 Dispatch
            </h2>
            <p className="text-sm text-haidee-muted">
              今日未分配货物矩阵 Unassigned cargo matrix · {displayDate}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Suspense
              fallback={
                <div className="h-11 w-40 animate-pulse rounded-lg bg-haidee-border/30" />
              }
            >
              <DispatchDateFilter />
            </Suspense>
            <Link
              href={`/dispatch/new?${new URLSearchParams({ date }).toString()}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-haidee-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-haidee-blue/90"
            >
              <Plus className="h-4 w-4" />
              新建派车单 New Dispatch
            </Link>
          </div>
        </div>

        <DispatchMatrix data={matrix} />
        <DispatchOrderList orders={orders} />
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            派车调度 Dispatch
          </h2>
          <p className="text-sm text-haidee-muted">{displayDate}</p>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
