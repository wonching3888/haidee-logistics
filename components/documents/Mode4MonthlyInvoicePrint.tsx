import type { WtlMonthlyInvoiceData } from "@/lib/monthly-invoice-mode4";
import { Mode4ListingPrint } from "@/components/documents/Mode4ListingPrint";
import { Mode4TaxInvoicePrint } from "@/components/documents/Mode4TaxInvoicePrint";
import "./document-print.css";

interface Mode4MonthlyInvoicePrintProps {
  data: WtlMonthlyInvoiceData;
}

export function Mode4MonthlyInvoicePrint({ data }: Mode4MonthlyInvoicePrintProps) {
  const pageCount = 2;
  return (
    <>
      <div className="invoice-print-page">
        <Mode4TaxInvoicePrint data={data} pageNumber={1} pageCount={pageCount} />
      </div>
      <div className="invoice-print-page">
        <Mode4ListingPrint data={data} pageNumber={2} pageCount={pageCount} />
      </div>
    </>
  );
}
