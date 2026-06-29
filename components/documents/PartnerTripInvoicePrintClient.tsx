"use client";

import type { PartnerTripInvoicePrintData } from "@/lib/partner-freight";
import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { PartnerTripInvoicePrint } from "@/components/documents/PartnerTripInvoicePrint";
import {
  formatMoneyAmount,
  formatMoneyWithCurrency,
  formatQty,
} from "@/lib/number-format";

interface PartnerTripInvoicePrintClientProps {
  data: PartnerTripInvoicePrintData;
  backHref?: string;
}

export function PartnerTripInvoicePrintClient({
  data,
  backHref,
}: PartnerTripInvoicePrintClientProps) {
  const shareText = [
    `Partner Trip Invoice ${data.invoiceNo}`,
    `${data.billToName} · ${data.truckPlate} · ${data.marketLabel}`,
    `Qty ${formatQty(data.quantity)} × ${formatMoneyAmount(data.unitRateMyr)} = ${formatMoneyWithCurrency(data.totalMyr, data.currency)}`,
  ].join("\n");

  return (
    <DOPrintPageWithShare
      title={`Partner Trip Invoice — ${data.invoiceNo}`}
      documentTitle={data.invoiceNo}
      backHref={backHref}
      sharePayload={{
        fileName: `${data.invoiceNo}.pdf`,
        title: data.invoiceNo,
        text: shareText,
      }}
    >
      <PartnerTripInvoicePrint data={data} />
    </DOPrintPageWithShare>
  );
}
