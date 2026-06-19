import type { WtlMonthlyInvoiceData } from "@/lib/monthly-invoice-mode4";
import { InvoiceListingPrint } from "@/components/documents/InvoiceListingPrint";

interface Mode4ListingPrintProps {
  data: WtlMonthlyInvoiceData;
}

export function Mode4ListingPrint({ data }: Mode4ListingPrintProps) {
  return (
    <InvoiceListingPrint
      issuerKey={data.mode.issuerKey}
      customerName={data.customerName}
      periodLabel={data.periodLabel}
      listing={data.listing}
    />
  );
}
