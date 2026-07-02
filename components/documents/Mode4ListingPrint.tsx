import type { WtlMonthlyInvoiceData } from "@/lib/monthly-invoice-mode4";
import { InvoiceListingPrint } from "@/components/documents/InvoiceListingPrint";

interface Mode4ListingPrintProps {
  data: WtlMonthlyInvoiceData;
  pageNumber?: number;
  pageCount?: number;
}

export function Mode4ListingPrint({
  data,
  pageNumber = 2,
  pageCount = 2,
}: Mode4ListingPrintProps) {
  return (
    <>
      <InvoiceListingPrint
        issuerKey={data.mode.issuerKey}
        customerName={data.customerName}
        periodLabel={data.periodLabel}
        listing={data.listing}
      />
      <div className="invoice-page-footer invoice-page-footer-standalone">
        Page {pageNumber} of {pageCount}
      </div>
    </>
  );
}
