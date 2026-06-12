import { Suspense } from "react";
import { searchInbound } from "@/app/actions/search";
import { PageError } from "@/components/shared/PageError";
import { SearchView } from "@/components/search/SearchView";
import { resolveDateParam } from "@/lib/date-utils";

interface SearchPageProps {
  searchParams: Promise<{ date?: string; q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const date = resolveDateParam(params.date);
  const query = params.q?.trim() ?? "";

  try {
    const data = query ? await searchInbound({ date, query }) : { rows: [], truckHeader: null };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">查询 Search</h2>
          <p className="text-sm text-haidee-muted">
            按寄货人、档口、车牌、桶型、备注查询 Query inbound records
          </p>
        </div>

        <Suspense
          fallback={
            <div className="h-24 animate-pulse rounded-xl bg-haidee-border/30" />
          }
        >
          <SearchView date={date} query={query} data={data} />
        </Suspense>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">查询 Search</h2>
          <p className="text-sm text-haidee-muted">
            按寄货人、档口、车牌、桶型、备注查询 Query inbound records
          </p>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
