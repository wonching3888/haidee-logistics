import { notFound } from "next/navigation";
import { fetchCrateReturnMonthlyInvoicePrintData } from "@/app/actions/crate-return-invoice";
import { CrateReturnMonthlyInvoicePrint } from "@/components/documents/CrateReturnMonthlyInvoicePrint";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { PageError } from "@/components/shared/PageError";
import {
  isValidListMonth,
  isValidListYear,
} from "@/lib/parse-year-month-params";

export const dynamic = "force-dynamic";

interface CrateReturnInvoicePrintPageProps {
  searchParams: Promise<{
    year?: string;
    month?: string;
    crateType?: string;
  }>;
}

export default async function CrateReturnInvoicePrintPage({
  searchParams,
}: CrateReturnInvoicePrintPageProps) {
  const params = await searchParams;
  const year = Number(params.year);
  const month = Number(params.month);
  const crateType = params.crateType?.trim() ?? "";

  if (!isValidListYear(year) || !isValidListMonth(month) || !crateType) {
    notFound();
  }

  try {
    const data = await fetchCrateReturnMonthlyInvoicePrintData({
      year,
      month,
      crateType,
    });

    const backHref = `/documents/crate-return-invoice?year=${year}&month=${month}`;

    return (
      <DOPrintPageWithShare
        title={`Crate Return Invoice — ${data.invoiceNo}`}
        documentTitle={data.invoiceNo}
        backHref={backHref}
        sharePayload={{
          fileName: `${data.invoiceNo}.pdf`,
          title: data.invoiceNo,
          text: `${data.billToName} · ${data.crateType} · ${year}-${String(month).padStart(2, "0")} · ${data.totalAmountMyr.toFixed(2)} MYR`,
        }}
      >
        <CrateReturnMonthlyInvoicePrint data={data} />
      </DOPrintPageWithShare>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-haidee-text">
          回收桶月结单 Crate Return Monthly Invoice
        </h2>
        <PageError error={error} />
      </div>
    );
  }
}
