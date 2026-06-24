import { Suspense } from "react";
import { getShippers, getTongTypes } from "@/app/actions/inbound";
import { searchInbound } from "@/app/actions/search";
import { PageError } from "@/components/shared/PageError";
import { SearchView } from "@/components/search/SearchView";
import { normalizeDateRange, resolveDateRangeParams } from "@/lib/date-utils";
import { parseSearchFiltersFromParams } from "@/lib/search-filters";

interface SearchPageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    date?: string;
    shipperId?: string;
    market?: string;
    tongTypeId?: string;
    plate?: string;
    docNo?: string;
    keyword?: string;
    q?: string;
  }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const range = resolveDateRangeParams(params.from, params.to, params.date);
  const { from: fromDate, to: toDate } = normalizeDateRange(range.from, range.to);

  const filters = parseSearchFiltersFromParams({
    ...params,
    from: fromDate,
    to: toDate,
  });

  try {
    const [data, shippers, tongTypes] = await Promise.all([
      searchInbound({
        fromDate,
        toDate,
        shipperId: filters.shipperId || undefined,
        marketCodes:
          filters.marketCodes.length > 0 ? filters.marketCodes : undefined,
        tongTypeId: filters.tongTypeId || undefined,
        plate: filters.plate || undefined,
        docNo: filters.docNo || undefined,
        keyword: filters.keyword || undefined,
      }),
      getShippers(),
      getTongTypes(),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">查询 Search</h2>
          <p className="text-sm text-haidee-muted">
            多条件筛选进货记录 Filter inbound lines by consignor, market, plate,
            crate type, doc no, and more
          </p>
        </div>

        <Suspense
          fallback={
            <div className="h-24 animate-pulse rounded-xl bg-haidee-border/30" />
          }
        >
          <SearchView
            filters={filters}
            data={data}
            shippers={shippers}
            tongTypes={tongTypes}
          />
        </Suspense>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">查询 Search</h2>
          <p className="text-sm text-haidee-muted">
            多条件筛选进货记录 Filter inbound lines by consignor, market, plate,
            crate type, doc no, and more
          </p>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
