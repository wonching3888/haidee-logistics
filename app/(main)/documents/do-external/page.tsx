import { notFound } from "next/navigation";
import { getDeliveryOrderData } from "@/app/actions/documents";
import { DeliveryOrderPrint } from "@/components/documents/DeliveryOrderPrint";
import { DOPrintPageLayout } from "@/components/documents/DOPrintPageLayout";

interface DOExternalPageProps {
  searchParams: Promise<{ dispatchId?: string }>;
}

export default async function DOExternalPage({
  searchParams,
}: DOExternalPageProps) {
  const params = await searchParams;
  const dispatchId = params.dispatchId?.trim();
  if (!dispatchId) notFound();

  const data = await getDeliveryOrderData(dispatchId);
  if (!data) notFound();

  return (
    <DOPrintPageLayout
      title="外部 D/O External D/O"
      documentTitle={`${data.doNumber}-${data.lorryNo}`}
    >
      <DeliveryOrderPrint data={data} showConsignor={false} />
    </DOPrintPageLayout>
  );
}
