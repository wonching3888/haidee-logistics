import { notFound } from "next/navigation";
import { fetchCrateReturnMonthlyInvoicePrintData } from "@/app/actions/crate-return-invoice";
import { CrateReturnMonthlyInvoicePrint } from "@/components/documents/CrateReturnMonthlyInvoicePrint";
import { DOPrintPageLayout } from "@/components/documents/DOPrintPageLayout";
import { PageError } from "@/components/shared/PageError";

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

  if (!Number.isInteger(year) || !Number.isInteger(month) || !crateType) {
    notFound();
  }

  try {
    const data = await fetchCrateReturnMonthlyInvoicePrintData({
      year,
      month,
      crateType,
    });

    return (
      <DOPrintPageLayout
        title={`Crate Return Invoice — ${data.invoiceNo}`}
        documentTitle={data.invoiceNo}
      >
        <CrateReturnMonthlyInvoicePrint data={data} />
      </DOPrintPageLayout>
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
