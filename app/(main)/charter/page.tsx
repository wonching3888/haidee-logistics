import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { getCharterTrips } from "@/app/actions/charter";
import { CharterDateFilter } from "@/components/charter/CharterDateFilter";
import { CharterDeletedBanner } from "@/components/charter/CharterDeletedBanner";
import { CharterMonthlyLedger } from "@/components/charter/CharterMonthlyLedger";
import { CharterTripList } from "@/components/charter/CharterTripList";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser } from "@/lib/auth";
import { currentCalendarYearMonth } from "@/lib/parse-year-month-params";
import { resolveDateParam } from "@/lib/date-utils";

interface CharterPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function CharterPage({ searchParams }: CharterPageProps) {
  const params = await searchParams;
  const date = resolveDateParam(params.date);

  try {
    const [trips, user] = await Promise.all([
      getCharterTrips(date),
      getCurrentUser(),
    ]);
    const { year, month } = currentCalendarYearMonth();
    const showMonthlyLedger = user?.role === "admin";

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-haidee-text">包车 Charter</h2>
            <p className="text-sm text-haidee-muted">
              独立录入海产 / 普货包车趟次 Independent charter trip entry
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Suspense
              fallback={
                <div className="h-11 w-40 animate-pulse rounded-lg bg-haidee-border/30" />
              }
            >
              <CharterDateFilter />
            </Suspense>
            <Link
              href={`/charter/new?${new URLSearchParams({ date }).toString()}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-haidee-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-haidee-blue/90"
            >
              <Plus className="h-4 w-4" />
              新建包车 New Charter
            </Link>
          </div>
        </div>

        <Suspense fallback={null}>
          <CharterDeletedBanner />
        </Suspense>

        <CharterTripList trips={trips} />

        {showMonthlyLedger ? (
          <CharterMonthlyLedger initialYear={year} initialMonth={month} />
        ) : null}
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">包车 Charter</h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
