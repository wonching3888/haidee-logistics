import { notFound } from "next/navigation";
import {
  getDispatchMarkets,
  getDispatchOrder,
  getDrivers,
  getTrucks,
} from "@/app/actions/dispatch";
import { DispatchForm } from "@/components/dispatch/DispatchForm";
import { getCurrentUser } from "@/lib/auth";
import { toDateInputValue } from "@/lib/date-utils";
import { t } from "@/lib/i18n/translate";

interface EditDispatchPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDispatchPage({ params }: EditDispatchPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  const locale = user?.language ?? "zh";

  const order = await getDispatchOrder(id);
  if (!order) notFound();

  const [trucks, drivers, marketOptions] = await Promise.all([
    getTrucks(),
    getDrivers(),
    getDispatchMarkets(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          {t("dispatch.edit", locale)}
        </h2>
        <p className="text-sm text-haidee-muted">
          <span className="font-mono">{order.dispatchNo}</span>
          {" · "}
          {order.truckPlate}
        </p>
      </div>

      <DispatchForm
        trucks={trucks}
        drivers={drivers}
        marketOptions={marketOptions}
        date={toDateInputValue(new Date(order.date))}
        initialOrder={{
          id: order.id,
          dispatchNo: order.dispatchNo,
          date: order.date,
          truckId: order.truckId,
          driverName: order.driverName,
          markets: order.markets,
          selections: order.selections,
        }}
      />
    </div>
  );
}
