import { notFound } from "next/navigation";
import { getDeliveryOrderData } from "@/app/actions/documents";
import { DeliveryOrderPrint } from "@/components/documents/DeliveryOrderPrint";
import { DOPrintPageLayout } from "@/components/documents/DOPrintPageLayout";

interface DOInternalPageProps {
  searchParams: Promise<{ dispatchId?: string }>;
}

export default async function DOInternalPage({
  searchParams,
}: DOInternalPageProps) {
  const params = await searchParams;
  const dispatchId = params.dispatchId?.trim();
  if (!dispatchId) notFound();

  const data = await getDeliveryOrderData(dispatchId);
  if (!data) notFound();

  return (
    <DOPrintPageLayout
      title="内部 D/O Internal D/O"
      documentTitle={`${data.doNumber}-${data.lorryNo}`}
    >
      <DeliveryOrderPrint data={data} showConsignor />
    </DOPrintPageLayout>
  );
}
