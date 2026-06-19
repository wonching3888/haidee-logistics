import { notFound } from "next/navigation";
import { getCrateTypeRecordData } from "@/app/actions/documents";
import { CrateTypeRecordPrint } from "@/components/documents/CrateTypeRecordPrint";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { resolveDateParam } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

interface CrateTypeRecordPageProps {
  searchParams: Promise<{
    date?: string;
    markets?: string;
    tongTypes?: string;
  }>;
}

function parseList(raw?: string | string[]): string[] {
  if (Array.isArray(raw)) {
    return raw.flatMap((part) => parseList(part));
  }
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

  const documentTitle = `CrateTypeRecord-${date}`;

  return (
    <DOPrintPageWithShare
      title="桶型总计 Crate Type Record"
      documentTitle={documentTitle}
      backHref={`/documents?date=${encodeURIComponent(date)}`}
      sharePayload={{
        fileName: `${documentTitle}.pdf`,
        title: documentTitle,
        text: `Crate Type Record · ${date} · ${marketCodes.length} markets`,
      }}
    >
      <CrateTypeRecordPrint data={data} />
    </DOPrintPageWithShare>
  );
}
