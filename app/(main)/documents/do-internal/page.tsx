import { notFound } from "next/navigation";
import { getDeliveryOrderData } from "@/app/actions/documents";
import { DeliveryOrderPrint } from "@/components/documents/DeliveryOrderPrint";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";

export const dynamic = "force-dynamic";

interface DOInternalPageProps {
  searchParams: Promise<{ dispatchId?: string }>;
}

export default async function DOInternalPage({
  searchParams,
}: DOInternalPageProps) {
  const params = await searchParams;
  const dispatchId = params.dispatchId?.trim();
  if (!dispatchId) notFound();

  const data = await getDeliveryOrderData(dispatchId, {
    mergeMode: "bySession",
  });
  if (!data) notFound();

  const documentTitle = `${data.doNumber}-${data.lorryNo}`;

  return (
    <DOPrintPageWithShare
      title="内部 D/O Internal D/O"
      documentTitle={documentTitle}
      sharePayload={{
        fileName: `${documentTitle}.pdf`,
        title: documentTitle,
        text: `Internal D/O ${data.doNumber} · ${data.lorryNo} · ${data.date}`,
      }}
    >
      <DeliveryOrderPrint data={data} showConsignor />
    </DOPrintPageWithShare>
  );
}
