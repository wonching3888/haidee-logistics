import { notFound } from "next/navigation";
import { getDeliveryOrderData } from "@/app/actions/documents";
import { DeliveryOrderPrint } from "@/components/documents/DeliveryOrderPrint";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";

export const dynamic = "force-dynamic";

interface DOExternalPageProps {
  searchParams: Promise<{ dispatchId?: string }>;
}

export default async function DOExternalPage({
  searchParams,
}: DOExternalPageProps) {
  const params = await searchParams;
  const dispatchId = params.dispatchId?.trim();
  if (!dispatchId) notFound();

  const data = await getDeliveryOrderData(dispatchId, {
    mergeMode: "byShipperAndStall",
  });
  if (!data) notFound();

  const documentTitle = `${data.doNumber}-${data.lorryNo}`;

  return (
    <DOPrintPageWithShare
      title="外部 D/O External D/O"
      documentTitle={documentTitle}
      sharePayload={{
        fileName: `${documentTitle}.pdf`,
        title: documentTitle,
        text: `External D/O ${data.doNumber} · ${data.lorryNo} · ${data.date}`,
      }}
    >
      <DeliveryOrderPrint data={data} showConsignor={false} />
    </DOPrintPageWithShare>
  );
}
