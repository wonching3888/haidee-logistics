import { notFound } from "next/navigation";
import { getMultiMarketDOData } from "@/app/actions/documents";
import { MarketDOPrint } from "@/components/documents/MarketDOPrint";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { PageError } from "@/components/shared/PageError";
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

    const documentTitle = `MarketDO-${data.marketCode}-${date}`;

    return (
      <DOPrintPageWithShare
        title={`市场 D/O Market D/O — ${marketCodes.join(" / ")}`}
        documentTitle={documentTitle}
        backHref={`/documents?date=${encodeURIComponent(date)}`}
        sharePayload={{
          fileName: `${documentTitle}.pdf`,
          title: documentTitle,
          text: `Market D/O ${marketCodes.join(", ")} · ${date}`,
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
