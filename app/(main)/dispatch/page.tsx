import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import {
  getDispatchOrders,
  getTrucks,
  getUnassignedMatrix,
} from "@/app/actions/dispatch";
import { DispatchMatrix } from "@/components/dispatch/DispatchMatrix";
import { DispatchOrderList } from "@/components/dispatch/DispatchOrderList";
import { DispatchDateFilter } from "@/components/dispatch/DispatchDateFilter";
import { PageError } from "@/components/shared/PageError";
import { requirePageUser } from "@/lib/auth";
import { canWrite } from "@/lib/auth-roles";
import { resolveDateParam } from "@/lib/date-utils";
import { t } from "@/lib/i18n/translate";

interface DispatchPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function DispatchPage({ searchParams }: DispatchPageProps) {
  const params = await searchParams;
  const date = resolveDateParam(params.date);
  const user = await requirePageUser();
  const locale = user.language;
  const userCanWrite = canWrite(user.role);

  try {
    const [matrix, orders, trucks] = await Promise.all([
      getUnassignedMatrix(date),
      getDispatchOrders(date),
      getTrucks(),
    ]);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-haidee-text">
              {t("dispatch.pageTitle", locale)}
            </h2>
            <p className="text-sm text-haidee-muted">
              {t("dispatch.matrixSubtitle", locale)}
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
            {userCanWrite ? (
              <Link
                href={`/dispatch/new?${new URLSearchParams({ date }).toString()}`}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-haidee-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-haidee-blue/90"
              >
                <Plus className="h-4 w-4" />
                {t("dispatch.new", locale)}
              </Link>
            ) : null}
          </div>
        </div>

        <DispatchMatrix data={matrix} locale={locale} />
        <DispatchOrderList orders={orders} trucks={trucks} />
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            {t("dispatch.pageTitle", locale)}
          </h2>
          <p className="text-sm text-haidee-muted">
            {t("dispatch.matrixSubtitle", locale)}
          </p>
        </div>
        <PageError error={error} locale={locale} />
      </div>
    );
  }
}
