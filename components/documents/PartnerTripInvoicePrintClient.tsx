"use client";

import type { PartnerTripInvoicePrintData } from "@/lib/partner-freight";
import { DOPrintPageLayout } from "@/components/documents/DOPrintPageLayout";
import { PartnerTripInvoicePrint } from "@/components/documents/PartnerTripInvoicePrint";

interface PartnerTripInvoicePrintClientProps {
  data: PartnerTripInvoicePrintData;
}

export function PartnerTripInvoicePrintClient({
  data,
}: PartnerTripInvoicePrintClientProps) {
  const shareText = [
    `Partner Trip Invoice ${data.invoiceNo}`,
    `${data.billToName} · ${data.truckPlate} · ${data.marketLabel}`,
    `Qty ${data.quantity} × ${data.unitRateMyr.toFixed(2)} = ${data.totalMyr.toFixed(2)} ${data.currency}`,
  ].join("\n");

  return (
    <DOPrintPageLayout
      title={`Partner Trip Invoice — ${data.invoiceNo}`}
      documentTitle={data.invoiceNo}
      pdfSharePrototype={{
        fileName: `${data.invoiceNo}.pdf`,
        title: data.invoiceNo,
        text: shareText,
      }}
    >
      <PartnerTripInvoicePrint data={data} />
    </DOPrintPageLayout>
  );
}
