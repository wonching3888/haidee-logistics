import { getDispatchMarkets, getDrivers, getTrucks } from "@/app/actions/dispatch";
import { DispatchForm } from "@/components/dispatch/DispatchForm";
import { getCurrentUser } from "@/lib/auth";
import { resolveDateParam } from "@/lib/date-utils";
import { t } from "@/lib/i18n/translate";

interface NewDispatchPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function NewDispatchPage({
  searchParams,
}: NewDispatchPageProps) {
  const params = await searchParams;
  const date = resolveDateParam(params.date);
  const user = await getCurrentUser();
  const locale = user?.language ?? "zh";
  const [trucks, drivers, marketOptions] = await Promise.all([
    getTrucks(),
    getDrivers(),
    getDispatchMarkets(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          {t("dispatch.new", locale)}
        </h2>
        <p className="text-sm text-haidee-muted">
          {t("dispatch.newSubtitle", locale)}
        </p>
      </div>

      <DispatchForm
        trucks={trucks}
        drivers={drivers}
        marketOptions={marketOptions}
        date={date}
      />
    </div>
  );
}
