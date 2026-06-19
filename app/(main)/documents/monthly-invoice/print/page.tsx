import { notFound } from "next/navigation";
import { getMonthlyInvoicePrintData } from "@/app/actions/monthly-invoice";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { HaideeMonthlyInvoicePrint } from "@/components/documents/HaideeMonthlyInvoicePrint";
import { Mode4MonthlyInvoicePrint } from "@/components/documents/Mode4MonthlyInvoicePrint";
import { MonthlyInvoicePrint } from "@/components/documents/MonthlyInvoicePrint";
import { PageError } from "@/components/shared/PageError";
import { isMonthlyInvoiceMode } from "@/lib/constants/monthly-invoice";
import { isHaideeMonthlyInvoiceData } from "@/lib/monthly-invoice-mode-haidee";
import { isWtlMonthlyInvoiceData } from "@/lib/monthly-invoice-mode4";
import {
  isValidListMonth,
  isValidListYear,
} from "@/lib/parse-year-month-params";

export const dynamic = "force-dynamic";

interface MonthlyInvoicePrintPageProps {
  searchParams: Promise<{
    year?: string;
    month?: string;
    mode?: string;
    customerId?: string;
    returnTo?: string;
  }>;
}

export default async function MonthlyInvoicePrintPage({
  searchParams,
}: MonthlyInvoicePrintPageProps) {
  const params = await searchParams;
  const year = Number(params.year);
  const month = Number(params.month);
  const mode = params.mode ?? "";
  const customerId = params.customerId ?? "";
  const returnTo = params.returnTo?.trim() ?? "";

  if (
    !isValidListYear(year) ||
    !isValidListMonth(month) ||
    !isMonthlyInvoiceMode(mode) ||
    !customerId
  ) {
    notFound();
  }

  try {
    const data = await getMonthlyInvoicePrintData({
      year,
      month,
      mode,
      customerId,
    });
    if (!data) notFound();

    const documentTitle = `MonthlyInvoice-${mode}-${data.customerCode}-${year}-${String(month).padStart(2, "0")}`;
    const backHref =
      returnTo ||
      `/documents/monthly-invoice?year=${year}&month=${month}&mode=${encodeURIComponent(mode)}`;

    return (
      <DOPrintPageWithShare
        title={`月结账单 Monthly Invoice — ${data.customerName}`}
        documentTitle={documentTitle}
        backHref={backHref}
        sharePayload={{
          fileName: `${documentTitle}.pdf`,
          title: documentTitle,
          text: `Monthly Invoice ${data.customerName} (${data.customerCode}) · ${mode} · ${year}-${String(month).padStart(2, "0")}`,
        }}
      >
        {isWtlMonthlyInvoiceData(data) ? (
          <Mode4MonthlyInvoicePrint data={data} />
        ) : isHaideeMonthlyInvoiceData(data) ? (
          <HaideeMonthlyInvoicePrint data={data} />
        ) : (
          <MonthlyInvoicePrint data={data} />
        )}
      </DOPrintPageWithShare>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-haidee-text">
          月结账单 Monthly Invoice
        </h2>
        <PageError error={error} />
      </div>
    );
  }
}
