import { notFound } from "next/navigation";
import { getDeliveryOrderData } from "@/app/actions/documents";
import { DeliveryOrderPrint } from "@/components/documents/DeliveryOrderPrint";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { getActiveDOColumns } from "@/lib/constants/tong-columns";

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

  const sectionCount = data.sections.length;
  const documentTitle = `${data.doNumber}-${data.lorryNo}-${sectionCount}sections`;
  const toolbarTitle =
    sectionCount > 1
      ? `内部 D/O Internal D/O — ${sectionCount} 份 · ${data.doNumber}`
      : `内部 D/O Internal D/O — ${data.doNumber}`;

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
        text: `Internal D/O ${data.doNumber} · ${data.lorryNo} · ${data.date} · ${sectionCount} section(s)`,
      }}
    >
      <DeliveryOrderPrint data={data} showConsignor />
    </DOPrintPageWithShare>
  );
}
