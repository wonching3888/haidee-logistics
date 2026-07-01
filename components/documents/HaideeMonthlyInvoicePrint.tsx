import type { HaideeMonthlyInvoiceData } from "@/lib/monthly-invoice-mode-haidee";
import { HaideeMarketInvoicePrint } from "@/components/documents/HaideeMarketInvoicePrint";
import { Mode1aTaxInvoicePrint } from "@/components/documents/Mode1aTaxInvoicePrint";
import { InvoiceListingPrint } from "@/components/documents/InvoiceListingPrint";
import "./document-print.css";

interface HaideeMonthlyInvoicePrintProps {
  data: HaideeMonthlyInvoiceData;
}

function usesAccountingPrint(data: HaideeMonthlyInvoiceData) {
  return data.mode.value === "1a" || data.mode.value === "1b";
}

export function HaideeMonthlyInvoicePrint({ data }: HaideeMonthlyInvoicePrintProps) {
  const pageCount = 2;
  const accounting = usesAccountingPrint(data);

  return (
    <>
      <div className="invoice-print-page">
        {accounting ? (
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
          tongSectionTitle={accounting ? "桶 / Crate" : undefined}
        />
        {accounting ? (
          <div className="invoice-page-footer invoice-page-footer-standalone">
            Page 2 of {pageCount}
          </div>
        ) : null}
      </div>
    </>
  );
}
