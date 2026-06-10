import { notFound } from "next/navigation";
import { getDispatchOrder, getDrivers, getTrucks } from "@/app/actions/dispatch";
import { DispatchForm } from "@/components/dispatch/DispatchForm";
import { toDateInputValue } from "@/lib/date-utils";

interface EditDispatchPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDispatchPage({ params }: EditDispatchPageProps) {
  const { id } = await params;

  const [order, trucks, drivers] = await Promise.all([
    getDispatchOrder(id),
    getTrucks(),
    getDrivers(),
  ]);

  if (!order) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          编辑派车单 Edit Dispatch
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
