import { notFound } from "next/navigation";
import { getArFreightListingPrintData } from "@/app/actions/ar-invoice-listing";
import { ArInvoiceListingPrint } from "@/components/documents/ArInvoiceListingPrint";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { PageError } from "@/components/shared/PageError";
import { isMonthlyInvoiceMode } from "@/lib/constants/monthly-invoice";
import {
  isValidListMonth,
  isValidListYear,
} from "@/lib/parse-year-month-params";

export const dynamic = "force-dynamic";

interface ArFreightListingPrintPageProps {
  searchParams: Promise<{
    year?: string;
    month?: string;
    mode?: string;
    returnTo?: string;
  }>;
}

export default async function ArFreightListingPrintPage({
  searchParams,
}: ArFreightListingPrintPageProps) {
  const params = await searchParams;
  const year = Number(params.year);
  const month = Number(params.month);
  const mode = params.mode ?? "";
  const returnTo = params.returnTo?.trim() ?? "";

  if (
    !isValidListYear(year) ||
    !isValidListMonth(month) ||
    !isMonthlyInvoiceMode(mode)
  ) {
    notFound();
  }

  try {
    const data = await getArFreightListingPrintData({ year, month, mode });
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    const documentTitle = `AR-Invoice-Listing-Freight-${mode}-${ym}`;
    const backHref =
      returnTo || `/financial/autocount-export?year=${year}&month=${month}`;

    return (
      <DOPrintPageWithShare
        title={`Invoice Listing — Freight ${mode} · ${ym}`}
        documentTitle={documentTitle}
        backHref={backHref}
        sharePayload={{
          fileName: `${documentTitle}.pdf`,
          title: documentTitle,
          text: `AR Invoice Listing · Freight · Mode ${mode} · ${ym}`,
        }}
      >
        <ArInvoiceListingPrint data={data} />
      </DOPrintPageWithShare>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-haidee-text">
          Invoice Listing — Freight
        </h2>
        <PageError error={error} />
      </div>
    );
  }
}
