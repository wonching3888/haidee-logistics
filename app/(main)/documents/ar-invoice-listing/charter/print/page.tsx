import { notFound } from "next/navigation";
import { getArCharterListingPrintData } from "@/app/actions/ar-invoice-listing";
import { ArInvoiceListingPrint } from "@/components/documents/ArInvoiceListingPrint";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { PageError } from "@/components/shared/PageError";
import {
  isValidListMonth,
  isValidListYear,
} from "@/lib/parse-year-month-params";

export const dynamic = "force-dynamic";

interface ArCharterListingPrintPageProps {
  searchParams: Promise<{
    year?: string;
    month?: string;
    returnTo?: string;
  }>;
}

export default async function ArCharterListingPrintPage({
  searchParams,
}: ArCharterListingPrintPageProps) {
  const params = await searchParams;
  const year = Number(params.year);
  const month = Number(params.month);
  const returnTo = params.returnTo?.trim() ?? "";

  if (!isValidListYear(year) || !isValidListMonth(month)) {
    notFound();
  }

  try {
    const data = await getArCharterListingPrintData({ year, month });
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    const documentTitle = `AR-Invoice-Listing-Charter-${ym}`;
    const backHref =
      returnTo || `/financial/autocount-export?year=${year}&month=${month}`;

    return (
      <DOPrintPageWithShare
        title={`Invoice Listing — Charter · ${ym}`}
        documentTitle={documentTitle}
        backHref={backHref}
        sharePayload={{
          fileName: `${documentTitle}.pdf`,
          title: documentTitle,
          text: `AR Invoice Listing · Charter · ${ym}`,
        }}
      >
        <ArInvoiceListingPrint data={data} />
      </DOPrintPageWithShare>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-haidee-text">
          Invoice Listing — Charter
        </h2>
        <PageError error={error} />
      </div>
    );
  }
}
