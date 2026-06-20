import { redirect } from "next/navigation";
import { getCharterFormOptions } from "@/app/actions/charter";
import { CharterTripForm } from "@/components/charter/CharterTripForm";
import { getCurrentUser } from "@/lib/auth";
import { resolveDateParam } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

interface NewCharterPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function NewCharterPage({ searchParams }: NewCharterPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const date = resolveDateParam(params.date);
  const { trucks, drivers, tongTypes } = await getCharterFormOptions();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">新建包车 New Charter</h2>
        <p className="text-sm text-haidee-muted">
          本页为整趟包车记录的唯一入口 This page is the sole entry for a charter trip.
        </p>
      </div>

      <CharterTripForm
        mode="new"
        date={date}
        trucks={trucks}
        drivers={drivers}
        tongTypes={tongTypes}
      />
    </div>
  );
}
