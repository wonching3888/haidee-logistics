import type { HaideeMonthlyInvoiceData } from "@/lib/monthly-invoice-mode-haidee";
import { HaideeMarketInvoicePrint } from "@/components/documents/HaideeMarketInvoicePrint";
import { InvoiceListingPrint } from "@/components/documents/InvoiceListingPrint";
import "./document-print.css";

interface HaideeMonthlyInvoicePrintProps {
  data: HaideeMonthlyInvoiceData;
}

export function HaideeMonthlyInvoicePrint({ data }: HaideeMonthlyInvoicePrintProps) {
  return (
    <>
      <div className="invoice-print-page">
        <HaideeMarketInvoicePrint data={data} />
      </div>
      <div className="invoice-print-page">
        <InvoiceListingPrint
          issuerKey={data.mode.issuerKey}
          customerName={data.customerName}
          periodLabel={data.periodLabel}
          listing={data.listing}
        />
      </div>
    </>
  );
}
