import { notFound } from "next/navigation";
import { getCrateTypeRecordData } from "@/app/actions/documents";
import { CrateTypeRecordPrint } from "@/components/documents/CrateTypeRecordPrint";
import { DOPrintPageLayout } from "@/components/documents/DOPrintPageLayout";
import { resolveDateParam } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

interface CrateTypeRecordPageProps {
  searchParams: Promise<{
    date?: string;
    markets?: string;
    tongTypes?: string;
  }>;
}

function parseList(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export default async function CrateTypeRecordPage({
  searchParams,
}: CrateTypeRecordPageProps) {
  const params = await searchParams;
  const date = resolveDateParam(params.date);
  const marketCodes = parseList(params.markets);
  const tongCodes = parseList(params.tongTypes);

  if (marketCodes.length === 0 || tongCodes.length === 0) notFound();

  const data = await getCrateTypeRecordData(date, { marketCodes, tongCodes });
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
