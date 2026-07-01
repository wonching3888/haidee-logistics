import type { HaideeMonthlyInvoiceData } from "@/lib/monthly-invoice-mode-haidee";
import { HaideeMarketInvoicePrint } from "@/components/documents/HaideeMarketInvoicePrint";
import { Mode1aTaxInvoicePrint } from "@/components/documents/Mode1aTaxInvoicePrint";
import { InvoiceListingPrint } from "@/components/documents/InvoiceListingPrint";
import "./document-print.css";

interface HaideeMonthlyInvoicePrintProps {
  data: HaideeMonthlyInvoiceData;
}

export function HaideeMonthlyInvoicePrint({ data }: HaideeMonthlyInvoicePrintProps) {
  const pageCount = 2;

  return (
    <>
      <div className="invoice-print-page">
        {data.mode.value === "1a" ? (
          <Mode1aTaxInvoicePrint
            data={data}
            pageNumber={1}
            pageCount={pageCount}
          />
        ) : (
          <HaideeMarketInvoicePrint data={data} />
        )}
      </div>
      <div className="invoice-print-page">
        <InvoiceListingPrint
          issuerKey={data.mode.issuerKey}
          customerName={data.customerName}
          periodLabel={data.periodLabel}
          listing={data.listing}
        />
        {data.mode.value === "1a" ? (
          <div className="invoice-page-footer invoice-page-footer-standalone">
            Page 2 of {pageCount}
          </div>
        ) : null}
      </div>
    </>
  );
}
