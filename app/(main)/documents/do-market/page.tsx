import { notFound } from "next/navigation";
import { getMultiMarketDOData } from "@/app/actions/documents";
import { MarketDOPrint } from "@/components/documents/MarketDOPrint";
import { DOPrintPageLayout } from "@/components/documents/DOPrintPageLayout";
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

    return (
      <DOPrintPageLayout
        title={`市场 D/O Market D/O — ${marketCodes.join(" / ")}`}
        documentTitle={`MarketDO-${data.marketCode}-${date}`}
      >
        <MarketDOPrint data={data} />
      </DOPrintPageLayout>
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
