import { notFound } from "next/navigation";
import { getCharterInvoiceData } from "@/app/actions/charter";
import { CharterInvoicePrintClient } from "@/components/charter/CharterInvoicePrintClient";
import { PageError } from "@/components/shared/PageError";

export const dynamic = "force-dynamic";

interface CharterInvoicePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}

export default async function CharterInvoicePage({
  params,
  searchParams,
}: CharterInvoicePageProps) {
  const { id } = await params;
  const { returnTo: returnToRaw } = await searchParams;
  const returnTo = returnToRaw?.trim() ?? "";

  try {
    const data = await getCharterInvoiceData(id);
    return (
      <CharterInvoicePrintClient
        data={data}
        backHref={returnTo || `/charter/${id}`}
      />
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("不存在")) {
      notFound();
    }
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-haidee-text">
          包车发票 Charter Invoice
        </h2>
        <PageError error={error} />
      </div>
    );
  }
}
