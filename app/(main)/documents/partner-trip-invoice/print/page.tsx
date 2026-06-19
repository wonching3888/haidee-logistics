import { notFound } from "next/navigation";
import { getPartnerTripInvoicePrintData } from "@/app/actions/partner-trip-invoice";
import { PartnerTripInvoicePrintClient } from "@/components/documents/PartnerTripInvoicePrintClient";
import { PageError } from "@/components/shared/PageError";

export const dynamic = "force-dynamic";

interface PartnerTripInvoicePrintPageProps {
  searchParams: Promise<{
    year?: string;
    month?: string;
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
  const year = Number(params.year);
  const month = Number(params.month);
  const tripDate = params.tripDate ?? "";
  const truckId = params.truckId ?? "";
  const marketId = params.marketId ?? "";
  const crateType = params.crateType ?? "SKTN";

  if (!tripDate || !truckId || !marketId) {
    notFound();
  }

  const backHref =
    Number.isInteger(year) && Number.isInteger(month)
      ? `/documents/partner-trip-invoice?year=${year}&month=${month}`
      : "/documents/partner-trip-invoice";

  try {
    const data = await getPartnerTripInvoicePrintData({
      tripDate,
      truckId,
      marketId,
      crateType,
    });

    return <PartnerTripInvoicePrintClient data={data} backHref={backHref} />;
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
