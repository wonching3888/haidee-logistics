import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { getInboundSessions, getShippers } from "@/app/actions/inbound";
import { InboundFilters } from "@/components/inbound/InboundFilters";
import { InboundListTable } from "@/components/inbound/InboundListTable";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n/translate";
import { serializeInboundSessionListRows, resolveInboundListQueryDate } from "@/lib/inbound-list";

export const dynamic = "force-dynamic";

interface InboundPageProps {
  searchParams: Promise<{
    date?: string;
    shipperId?: string;
    status?: string;
    search?: string;
  }>;
}

export default async function InboundPage({ searchParams }: InboundPageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const locale = user?.language ?? "zh";
  const filters = {
    date: resolveInboundListQueryDate(params.date),
    shipperId: params.shipperId,
    status: params.status as "unassigned" | "assigned" | "draft" | undefined,
    search: params.search,
  };

  try {
    const [sessions, shippers] = await Promise.all([
      getInboundSessions(filters),
      getShippers(),
    ]);

    return (
      <div className="flex min-h-0 min-w-0 flex-col gap-4 md:h-full md:gap-6">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-haidee-text">
              {t("inbound.pageTitle", locale)}
            </h2>
            <p className="text-sm text-haidee-muted">
              {t("inbound.pageSubtitle", locale)}
            </p>
          </div>
          <Link
            href="/inbound/new"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-haidee-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-haidee-blue/90"
          >
            <Plus className="h-4 w-4" />
            {t("inbound.new", locale)}
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="h-24 shrink-0 animate-pulse rounded-xl bg-haidee-border/30" />
          }
        >
          <div className="shrink-0">
            <InboundFilters shippers={shippers} />
          </div>
        </Suspense>

        <div className="min-w-0 md:min-h-0 md:flex-1">
          <InboundListTable
            sessions={serializeInboundSessionListRows(sessions)}
            locale={locale}
          />
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="min-w-0 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            {t("inbound.pageTitle", locale)}
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
