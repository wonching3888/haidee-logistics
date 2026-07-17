import { notFound } from "next/navigation";
import { getArCrateReturnListingPrintData } from "@/app/actions/ar-invoice-listing";
import { ArInvoiceListingPrint } from "@/components/documents/ArInvoiceListingPrint";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { PageError } from "@/components/shared/PageError";
import {
  isValidListMonth,
  isValidListYear,
} from "@/lib/parse-year-month-params";

export const dynamic = "force-dynamic";

interface ArCrateReturnListingPrintPageProps {
  searchParams: Promise<{
    year?: string;
    month?: string;
    returnTo?: string;
  }>;
}

export default async function ArCrateReturnListingPrintPage({
  searchParams,
}: ArCrateReturnListingPrintPageProps) {
  const params = await searchParams;
  const year = Number(params.year);
  const month = Number(params.month);
  const returnTo = params.returnTo?.trim() ?? "";

  if (!isValidListYear(year) || !isValidListMonth(month)) {
    notFound();
  }

  try {
    const data = await getArCrateReturnListingPrintData({ year, month });
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    const documentTitle = `AR-Invoice-Listing-CrateReturn-${ym}`;
    const backHref =
      returnTo || `/financial/autocount-export?year=${year}&month=${month}`;

    return (
      <DOPrintPageWithShare
        title={`Invoice Listing — Crate Return · ${ym}`}
        documentTitle={documentTitle}
        backHref={backHref}
        sharePayload={{
          fileName: `${documentTitle}.pdf`,
          title: documentTitle,
          text: `AR Invoice Listing · Crate Return · ${ym}`,
        }}
      >
        <ArInvoiceListingPrint data={data} />
      </DOPrintPageWithShare>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-haidee-text">
          Invoice Listing — Crate Return
        </h2>
        <PageError error={error} />
      </div>
    );
  }
}
