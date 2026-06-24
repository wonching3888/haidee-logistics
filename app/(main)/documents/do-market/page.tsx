import { notFound } from "next/navigation";
import { getMultiMarketDOData } from "@/app/actions/documents";
import { MarketDOPrint } from "@/components/documents/MarketDOPrint";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { PageError } from "@/components/shared/PageError";
import { getActiveDOColumns } from "@/lib/constants/tong-columns";
import { resolveDateParam } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

interface DOMarketPageProps {
  searchParams: Promise<{ date?: string; markets?: string }>;
}

export default async function DOMarketPage({
  searchParams,
}: DOMarketPageProps) {
  const params = await searchParams;
  const date = resolveDateParam(params.date);
  const marketCodes = (params.markets ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  if (marketCodes.length === 0) notFound();

  try {
    const data = await getMultiMarketDOData(date, marketCodes);
    if (!data) notFound();

    const sectionCount = data.sections.length;
    const documentTitle = `MarketDO-${date}-${sectionCount}sections`;
    const toolbarTitle =
      sectionCount > 0
        ? `市场 D/O Market D/O — ${sectionCount} 份 · ${marketCodes.join(" / ")}`
        : `市场 D/O Market D/O — ${marketCodes.join(" / ")}`;

    const maxActiveColumns = data.sections.reduce(
      (max, section) =>
        Math.max(max, getActiveDOColumns(section.rows).length),
      0
    );

    return (
      <DOPrintPageWithShare
        title={toolbarTitle}
        documentTitle={documentTitle}
        backHref={`/documents?date=${encodeURIComponent(date)}`}
        sectionSelector=".market-do-print-section"
        activeColumnCount={maxActiveColumns}
        sharePayload={{
          fileName: `${documentTitle}.pdf`,
          title: documentTitle,
          text: `Market D/O ${marketCodes.join(", ")} · ${date} · ${sectionCount} section(s)`,
        }}
      >
        <MarketDOPrint data={data} />
      </DOPrintPageWithShare>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-haidee-text">
          市场 D/O Market D/O
        </h2>
        <PageError error={error} />
      </div>
    );
  }
}
