import { notFound } from "next/navigation";
import { getMultiCrateByTypeData } from "@/app/actions/documents";
import { CrateByTypePrint } from "@/components/documents/CrateByTypePrint";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { resolveDateParam } from "@/lib/date-utils";

interface CrateByTypePageProps {
  searchParams: Promise<{ date?: string; selections?: string }>;
}

function parseSelections(raw?: string) {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [marketCode, tongCode] = part.split(":");
      return marketCode && tongCode ? { marketCode, tongCode } : null;
    })
    .filter((x): x is { marketCode: string; tongCode: string } => x !== null);
}

export default async function CrateByTypePage({
  searchParams,
}: CrateByTypePageProps) {
  const params = await searchParams;
  const date = resolveDateParam(params.date);
  const selections = parseSelections(params.selections);

  if (selections.length === 0) notFound();

  const data = await getMultiCrateByTypeData(date, selections);
  if (!data) notFound();

  const title =
    selections.length === 1
      ? `桶型统计 Crate — ${selections[0].marketCode} / ${data.sections[0]?.tongHeader}`
      : `桶型统计 Crate — ${selections.length} 组`;

  const documentTitle = `Crate-${date}-${selections.length}`;

  return (
    <DOPrintPageWithShare
      title={title}
      documentTitle={documentTitle}
      backHref={`/documents?date=${encodeURIComponent(date)}`}
      sharePayload={{
        fileName: `${documentTitle}.pdf`,
        title: documentTitle,
        text: `${title} · ${date}`,
      }}
    >
      <CrateByTypePrint data={data} />
    </DOPrintPageWithShare>
  );
}
