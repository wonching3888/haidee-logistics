import { notFound } from "next/navigation";
import { getDeliveryOrderData } from "@/app/actions/documents";
import { DeliveryOrderPrint } from "@/components/documents/DeliveryOrderPrint";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { getActiveDOColumns } from "@/lib/constants/tong-columns";

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

  const sectionCount = data.sections.length;
  const documentTitle = `${data.doNumber}-${data.lorryNo}-${sectionCount}sections`;
  const toolbarTitle =
    sectionCount > 1
      ? `外部 D/O External D/O — ${sectionCount} 份 · ${data.doNumber}`
      : `外部 D/O External D/O — ${data.doNumber}`;

  const maxActiveColumns = data.sections.reduce(
    (max, section) =>
      Math.max(max, getActiveDOColumns(section.rows).length),
    0
  );

  return (
    <DOPrintPageWithShare
      title={toolbarTitle}
      documentTitle={documentTitle}
      sectionSelector=".delivery-order-print-section"
      activeColumnCount={maxActiveColumns}
      sharePayload={{
        fileName: `${documentTitle}.pdf`,
        title: documentTitle,
        text: `External D/O ${data.doNumber} · ${data.lorryNo} · ${data.date} · ${sectionCount} section(s)`,
      }}
    >
      <DeliveryOrderPrint data={data} showConsignor={false} />
    </DOPrintPageWithShare>
  );
}
