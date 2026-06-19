import { notFound } from "next/navigation";
import { getPartnerTripInvoicePrintData } from "@/app/actions/partner-trip-invoice";
import { PartnerTripInvoicePrintClient } from "@/components/documents/PartnerTripInvoicePrintClient";
import { PageError } from "@/components/shared/PageError";

export const dynamic = "force-dynamic";

interface PartnerTripInvoicePrintPageProps {
  searchParams: Promise<{
    tripDate?: string;
    truckId?: string;
    marketId?: string;
    crateType?: string;
  }>;
}

export default async function PartnerTripInvoicePrintPage({
  searchParams,
}: PartnerTripInvoicePrintPageProps) {
  const params = await searchParams;
  const tripDate = params.tripDate ?? "";
  const truckId = params.truckId ?? "";
  const marketId = params.marketId ?? "";
  const crateType = params.crateType ?? "SKTN";

  if (!tripDate || !truckId || !marketId) {
    notFound();
  }

  try {
    const data = await getPartnerTripInvoicePrintData({
      tripDate,
      truckId,
      marketId,
      crateType,
    });

    return <PartnerTripInvoicePrintClient data={data} />;
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-haidee-text">
          合作伙伴车力单 Partner Trip Invoice
        </h2>
        <PageError error={error} />
      </div>
    );
  }
}
