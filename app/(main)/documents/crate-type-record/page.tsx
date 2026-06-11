import { notFound } from "next/navigation";
import { getCrateTypeRecordData } from "@/app/actions/documents";
import { CrateTypeRecordPrint } from "@/components/documents/CrateTypeRecordPrint";
import { DOPrintPageLayout } from "@/components/documents/DOPrintPageLayout";
import { resolveDateParam } from "@/lib/date-utils";

interface CrateTypeRecordPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function CrateTypeRecordPage({
  searchParams,
}: CrateTypeRecordPageProps) {
  const params = await searchParams;
  const date = resolveDateParam(params.date);
  const data = await getCrateTypeRecordData(date);
  if (!data) notFound();

  return (
    <DOPrintPageLayout
      title="桶型总计 Crate Type Record"
      documentTitle={`CrateTypeRecord-${date}`}
    >
      <CrateTypeRecordPrint data={data} />
    </DOPrintPageLayout>
  );
}
