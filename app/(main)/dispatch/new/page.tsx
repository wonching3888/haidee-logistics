import { getTrucks } from "@/app/actions/dispatch";
import { DispatchForm } from "@/components/dispatch/DispatchForm";
import { resolveDateParam } from "@/lib/date-utils";

interface NewDispatchPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function NewDispatchPage({
  searchParams,
}: NewDispatchPageProps) {
  const params = await searchParams;
  const date = resolveDateParam(params.date);
  const trucks = await getTrucks();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          新建派车单 New Dispatch
        </h2>
        <p className="text-sm text-haidee-muted">
          选择车辆、目的市场并勾选货物 Select truck, markets and cargo
        </p>
      </div>

      <DispatchForm trucks={trucks} date={date} />
    </div>
  );
}
