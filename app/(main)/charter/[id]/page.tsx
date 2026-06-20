import { notFound, redirect } from "next/navigation";
import { getCharterFormOptions, getCharterTrip } from "@/app/actions/charter";
import { CharterTripForm } from "@/components/charter/CharterTripForm";
import { getCurrentUser } from "@/lib/auth";

interface EditCharterPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCharterPage({ params }: EditCharterPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const [trip, options] = await Promise.all([
    getCharterTrip(id),
    getCharterFormOptions(),
  ]);

  if (!trip) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">编辑包车 Edit Charter</h2>
        <p className="text-sm text-haidee-muted">
          {trip.charterNo ?? trip.id} · {trip.truckPlate}
        </p>
      </div>

      <CharterTripForm
        mode="edit"
        date={trip.date}
        trucks={options.trucks}
        drivers={options.drivers}
        tongTypes={options.tongTypes}
        shippers={options.shippers}
        initial={trip}
      />
    </div>
  );
}
