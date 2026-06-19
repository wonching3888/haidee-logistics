import type { WtlMonthlyInvoiceData } from "@/lib/monthly-invoice-mode4";
import { Mode4ListingPrint } from "@/components/documents/Mode4ListingPrint";
import { Mode4TaxInvoicePrint } from "@/components/documents/Mode4TaxInvoicePrint";
import "./document-print.css";

interface Mode4MonthlyInvoicePrintProps {
  data: WtlMonthlyInvoiceData;
}

export function Mode4MonthlyInvoicePrint({ data }: Mode4MonthlyInvoicePrintProps) {
  return (
    <>
      <div className="invoice-print-page">
        <Mode4TaxInvoicePrint data={data} />
      </div>
      <div className="invoice-print-page">
        <Mode4ListingPrint data={data} />
      </div>
    </>
  );
}
